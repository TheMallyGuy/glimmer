package com.mally.glimmer

import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.ServiceConnection
import android.os.Binder
import android.os.IBinder
import android.os.Parcel
import java.util.concurrent.CountDownLatch
import java.util.concurrent.LinkedBlockingQueue
import java.util.concurrent.TimeUnit

/**
 * Talks to the RPC service of the Discord app (`com.discord.socialsdk.rpc.IDiscordRpcService`) over raw binder
 * transactions, so the AIDL files do not have to be copied. Rust calls it through JNI (`commands/discord_android.rs`).
 * Every frame is a JSON string; the service only understands SET_ACTIVITY.
 */
object DiscordRpcBridge {
    private const val SERVICE = "com.discord.socialsdk.rpc.IDiscordRpcService"
    private const val CONNECTION = "com.discord.socialsdk.rpc.IDiscordRpcConnection"
    private const val CALLBACK = "com.discord.socialsdk.rpc.IDiscordRpcCallback"
    private const val DISCORD = "com.discord"
    private const val DISCORD_SERVICE = "com.discord.socialrpc.DiscordRpcService"

    private const val CONNECT = 1
    private const val SEND_FRAME = 1
    private const val DISCONNECT = 2
    private const val ON_FRAME = 1
    private const val ON_CLOSE = 2

    private val frames = LinkedBlockingQueue<String>()
    private var bound: ServiceConnection? = null
    private var context: Context? = null
    private var connection: IBinder? = null

    /** Discord calls this with what it says: the READY frame, the answers, and the close */
    private val callback = object : Binder() {
        init {
            attachInterface(null, CALLBACK)
        }

        override fun onTransact(code: Int, data: Parcel, reply: Parcel?, flags: Int): Boolean {
            if (code !in 1..0xFFFFFF) return super.onTransact(code, data, reply, flags)
            data.enforceInterface(CALLBACK)
            when (code) {
                ON_FRAME -> frames.offer(data.readString() ?: "")
                ON_CLOSE -> {
                    val closeCode = data.readInt()
                    frames.offer("""{"evt":"CLOSE","code":$closeCode}""")
                    connection = null
                }
                else -> return super.onTransact(code, data, reply, flags)
            }
            reply?.writeNoException()
            return true
        }
    }

    /** gives null when connected, else what went wrong */
    @JvmStatic
    @Synchronized
    fun connect(appContext: Context, applicationId: Long, version: String): String? {
        disconnect()
        val app = appContext.applicationContext
        val binderReady = CountDownLatch(1)
        var service: IBinder? = null
        val serviceConnection = object : ServiceConnection {
            override fun onServiceConnected(name: ComponentName, binder: IBinder) {
                service = binder
                binderReady.countDown()
            }

            override fun onServiceDisconnected(name: ComponentName) {
                connection = null
            }

            override fun onNullBinding(name: ComponentName) = binderReady.countDown()
            override fun onBindingDied(name: ComponentName) = binderReady.countDown()
        }
        val intent = Intent(SERVICE).setComponent(ComponentName(DISCORD, DISCORD_SERVICE))
        val started = try {
            app.bindService(intent, serviceConnection, Context.BIND_AUTO_CREATE)
        } catch (e: SecurityException) {
            return "Discord refused the bind: ${e.message}"
        }
        if (!started) {
            app.unbindService(serviceConnection)
            return "cannot bind the Discord RPC service: is Discord installed, and does the manifest list it under <queries>?"
        }
        if (!binderReady.await(5, TimeUnit.SECONDS) || service == null) {
            app.unbindService(serviceConnection)
            return "the Discord RPC service did not answer"
        }

        val data = Parcel.obtain()
        val reply = Parcel.obtain()
        try {
            data.writeInterfaceToken(SERVICE)
            data.writeLong(applicationId)
            data.writeString(version)
            data.writeStrongBinder(callback)
            service!!.transact(CONNECT, data, reply, 0)
            reply.readException()
            connection = reply.readStrongBinder()
        } catch (e: Exception) {
            app.unbindService(serviceConnection)
            return "connect failed: ${e.message}"
        } finally {
            data.recycle()
            reply.recycle()
        }
        if (connection == null) {
            app.unbindService(serviceConnection)
            return "Discord turned the connection down (it allows 10 at a time)"
        }
        frames.clear()
        context = app
        bound = serviceConnection
        return null
    }

    /** sends one frame, then gives what Discord said within `waitMs`, one frame per line; an error starts with "error: " */
    @JvmStatic
    fun send(frame: String, waitMs: Long): String {
        val remote = connection ?: return "error: not connected"
        val data = Parcel.obtain()
        val reply = Parcel.obtain()
        try {
            data.writeInterfaceToken(CONNECTION)
            data.writeString(frame)
            remote.transact(SEND_FRAME, data, reply, 0)
            reply.readException()
        } catch (e: Exception) {
            return "error: ${e.message}"
        } finally {
            data.recycle()
            reply.recycle()
        }
        val first = frames.poll(waitMs, TimeUnit.MILLISECONDS) ?: return ""
        return (listOf(first) + drainList()).joinToString("\n")
    }

    /** what Discord said since the last call, one frame per line */
    @JvmStatic
    fun drain(): String = drainList().joinToString("\n")

    @JvmStatic
    @Synchronized
    fun disconnect() {
        connection?.let {
            val data = Parcel.obtain()
            val reply = Parcel.obtain()
            try {
                data.writeInterfaceToken(CONNECTION)
                it.transact(DISCONNECT, data, reply, 0)
            } catch (_: Exception) {
            } finally {
                data.recycle()
                reply.recycle()
            }
        }
        connection = null
        bound?.let { context?.unbindService(it) }
        bound = null
        context = null
    }

    private fun drainList(): List<String> = ArrayList<String>().also { frames.drainTo(it) }
}
