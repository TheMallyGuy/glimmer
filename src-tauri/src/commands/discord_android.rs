use tauri_helper::auto_collect_command;

/// Rich presence through the Discord app on Android: Discord has a bound service
/// (`com.discord.socialsdk.rpc.IDiscordRpcService`) that takes SET_ACTIVITY frames as JSON strings.
/// The binder work is in `DiscordRpcBridge.kt`; these commands call it through JNI. The commands exist
/// on every platform (tauri-helper collects by name), but only Android has Discord's service.
#[cfg(target_os = "android")]
mod bridge {
    use jni::objects::{JClass, JObject, JString, JValue};
    use jni::{JNIEnv, JavaVM};

    const CLASS: &str = "com.mally.glimmer.DiscordRpcBridge";

    /// runs `f` with the Kotlin bridge class and the app context. A thread of the async runtime is not
    /// a Java thread yet, and its `FindClass` cannot see the app's classes, so the class comes from the
    /// context's class loader.
    pub fn with_bridge<T>(
        f: impl FnOnce(&mut JNIEnv, &JClass, &JObject) -> jni::errors::Result<T>,
    ) -> Result<T, String> {
        let ctx = ndk_context::android_context();
        let vm = unsafe { JavaVM::from_raw(ctx.vm().cast()) }.map_err(|e| e.to_string())?;
        let mut env = vm.attach_current_thread().map_err(|e| e.to_string())?;
        let context = unsafe { JObject::from_raw(ctx.context().cast()) };

        let result = (|| {
            let loader = env
                .call_method(&context, "getClassLoader", "()Ljava/lang/ClassLoader;", &[])?
                .l()?;
            let name = env.new_string(CLASS)?;
            let class = JClass::from(
                env.call_method(
                    &loader,
                    "loadClass",
                    "(Ljava/lang/String;)Ljava/lang/Class;",
                    &[JValue::Object(&name)],
                )?
                .l()?,
            );
            f(&mut env, &class, &context)
        })();

        result.map_err(|e| {
            let _ = env.exception_clear();
            e.to_string()
        })
    }

    /// a String the bridge gave back; null is None
    pub fn text(env: &mut JNIEnv, value: JObject) -> jni::errors::Result<Option<String>> {
        if value.is_null() {
            return Ok(None);
        }
        let s: String = env.get_string(&JString::from(value))?.into();
        Ok(Some(s))
    }

    /// the frames of a bridge answer, one per line
    pub fn frames(answer: Option<String>) -> Vec<String> {
        answer
            .unwrap_or_default()
            .lines()
            .filter(|l| !l.is_empty())
            .map(str::to_owned)
            .collect()
    }
}

#[cfg(target_os = "android")]
use jni::objects::JValue;

#[cfg(not(target_os = "android"))]
const ONLY_ANDROID: &str = "Discord's Android RPC service only exists on Android";

/// Connects to the Discord app as the Discord application `application_id` (a number, as text).
/// `version` is the RPC version Discord expects; it is "1".
#[tauri::command]
#[specta::specta]
#[auto_collect_command]
pub async fn discord_android_connect(
    application_id: String,
    version: Option<String>,
) -> Result<(), String> {
    #[cfg(target_os = "android")]
    {
        let id: i64 = application_id
            .trim()
            .parse()
            .map_err(|_| format!("not an application id: {application_id}"))?;
        let version = version.unwrap_or_else(|| "1".into());
        // Discord's bind callbacks arrive on the main thread, so this must not run there: async commands don't
        let error = bridge::with_bridge(|env, class, context| {
            let version = env.new_string(version)?;
            let answer = env
                .call_static_method(
                    class,
                    "connect",
                    "(Landroid/content/Context;JLjava/lang/String;)Ljava/lang/String;",
                    &[
                        JValue::Object(context),
                        JValue::Long(id),
                        JValue::Object(&version),
                    ],
                )?
                .l()?;
            bridge::text(env, answer)
        })?;
        error.map_or(Ok(()), Err)
    }
    #[cfg(not(target_os = "android"))]
    {
        let _ = (application_id, version);
        Err(ONLY_ANDROID.into())
    }
}

/// Sends one frame (a JSON string, e.g. a SET_ACTIVITY command) and gives back what Discord says within
/// `wait_ms` (default 1500), one frame per entry. The first frame after a connect is READY.
#[tauri::command]
#[specta::specta]
#[auto_collect_command]
pub async fn discord_android_send(
    frame: String,
    wait_ms: Option<u32>,
) -> Result<Vec<String>, String> {
    #[cfg(target_os = "android")]
    {
        let wait = i64::from(wait_ms.unwrap_or(1500));
        let answer = bridge::with_bridge(|env, class, _| {
            let frame = env.new_string(frame)?;
            let answer = env
                .call_static_method(
                    class,
                    "send",
                    "(Ljava/lang/String;J)Ljava/lang/String;",
                    &[JValue::Object(&frame), JValue::Long(wait)],
                )?
                .l()?;
            bridge::text(env, answer)
        })?;
        if let Some(e) = answer.as_deref().and_then(|a| a.strip_prefix("error: ")) {
            return Err(e.to_owned());
        }
        Ok(bridge::frames(answer))
    }
    #[cfg(not(target_os = "android"))]
    {
        let _ = (frame, wait_ms);
        Err(ONLY_ANDROID.into())
    }
}

/// What Discord said since the last call (READY, close), one frame per entry.
#[tauri::command]
#[specta::specta]
#[auto_collect_command]
pub async fn discord_android_drain() -> Result<Vec<String>, String> {
    #[cfg(target_os = "android")]
    {
        let answer = bridge::with_bridge(|env, class, _| {
            let answer = env
                .call_static_method(class, "drain", "()Ljava/lang/String;", &[])?
                .l()?;
            bridge::text(env, answer)
        })?;
        Ok(bridge::frames(answer))
    }
    #[cfg(not(target_os = "android"))]
    Err(ONLY_ANDROID.into())
}

/// Closes the connection and lets go of the service. Safe to call when not connected.
#[tauri::command]
#[specta::specta]
#[auto_collect_command]
pub async fn discord_android_disconnect() -> Result<(), String> {
    #[cfg(target_os = "android")]
    {
        bridge::with_bridge(|env, class, _| {
            env.call_static_method(class, "disconnect", "()V", &[])?;
            Ok(())
        })
    }
    #[cfg(not(target_os = "android"))]
    Err(ONLY_ANDROID.into())
}
