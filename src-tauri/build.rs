fn main() {
    #[cfg(target_os = "macos")]
    {
        let manifest_dir = std::env::var("CARGO_MANIFEST_DIR").unwrap();
        let plist_path = format!("{manifest_dir}/Info.plist");
        println!("cargo:rerun-if-changed={plist_path}");
        println!("cargo:rustc-link-arg=-sectcreate");
        println!("cargo:rustc-link-arg=__TEXT");
        println!("cargo:rustc-link-arg=__info_plist");
        println!("cargo:rustc-link-arg={plist_path}");
    }
    tauri_build::build()
}
