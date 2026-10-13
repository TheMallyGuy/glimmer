// Windows, macOS and Linux only: these need processes, windows or the registry.
#[cfg(desktop)]
pub mod desktop;
#[cfg(desktop)]
pub use desktop::*;

pub mod keyring;
pub use keyring::*;

pub mod log_watcher;
pub use log_watcher::*;

pub mod discord_android;
pub use discord_android::*;
