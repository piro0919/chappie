// Microphone signal-processing front end built on WebRTC's
// AudioProcessing module. Sits between the rubato resampler (48 k → 16 k)
// and Silero VAD in `audio.rs::segmenter_loop` and applies:
//
//   * **HPF** — strips DC / wind rumble below ~80 Hz.
//   * **Noise suppression** — kills steady fan / aircon / keyboard hiss
//     without nuking voice.
//   * **AGC2 (digital)** — normalises level so a quiet user speaking
//     half a metre away lands at roughly the same loudness as someone
//     leaning into the mic. Removes the "must shout to wake Chappie"
//     failure mode.
//
// **AEC is intentionally off in v0.10.** WebRTC's AEC needs a far-end
// reference signal (whatever's coming out of the speaker) on every
// process_capture_frame() call. We don't have a reliable system loopback
// hook yet — adding one means a separate macOS ScreenCaptureKit audio
// capture stream (and the Windows-equivalent WASAPI loopback later).
// Once that lands the AEC switch flips here without touching audio.rs.
//
// WebRTC APM is hardcoded to operate on 10 ms frames. At our 16 kHz
// target rate that's 160 samples per frame. The segmenter loop drains
// the resampled output 160 samples at a time, calls `process_mono`, and
// then feeds the (possibly modified) samples into Silero VAD's 512-sample
// frames as before.
//
// **Platform split.** `webrtc-audio-processing`'s `bundled` feature builds
// the C++ library from source using a meson/`cp` flow that is not
// MSVC-compatible (the build script shells out to the Unix `cp`). So the
// real APM is compiled only on non-Windows targets; Windows gets a
// pass-through `imp` below where frames flow through unmodified. The
// segmenter in `audio.rs` is identical on both — it only ever touches
// `apm::{build, process_mono, APM_FRAME_SAMPLES, Processor}`, so the
// Windows mic path simply runs without AGC2/NS/HPF until a pure-Rust
// front end is wired in.

/// 10 ms @ 16 kHz, which is what WebRTC APM is built around. The
/// segmenter loop must drain `accum_out` in multiples of this before
/// calling `process_mono`.
pub const APM_FRAME_SAMPLES: usize = 160;

#[cfg(not(target_os = "windows"))]
mod imp {
    use super::APM_FRAME_SAMPLES;
    use webrtc_audio_processing::config::{
        AdaptiveDigital, Config, GainController, GainController2, HighPassFilter, NoiseSuppression,
        NoiseSuppressionLevel,
    };
    pub use webrtc_audio_processing::Processor;

    const TARGET_RATE: u32 = 16_000;

    /// Build a Processor configured for chappie's mic path: HPF on, NS at
    /// the high (3rd) level, AGC2 (digital) on, AEC off. Returns an error
    /// only if the native APM constructor itself fails (extremely rare in
    /// practice — usually only when the bundled lib was built with the
    /// audio-processing-module excluded).
    pub fn build() -> Result<Processor, String> {
        let processor = Processor::new(TARGET_RATE).map_err(|e| format!("apm new: {e:?}"))?;
        let config = Config {
            high_pass_filter: Some(HighPassFilter::default()),
            noise_suppression: Some(NoiseSuppression {
                level: NoiseSuppressionLevel::High,
                ..Default::default()
            }),
            // AGC2 with the adaptive digital stage explicitly turned on.
            // GainController2::default() leaves `adaptive_digital = None` and
            // `fixed_digital = 0 dB`, which means literally no gain — voice
            // RMS at the mic stays at whatever the user's input level was,
            // and quiet speakers continue to fall under the MIN_RMS_ENERGY
            // gate downstream. Enabling adaptive_digital starts at +15 dB and
            // can ramp up to +50 dB, which is what actually solves "Chappie
            // can't hear me unless I shout". We don't touch input_volume_-
            // controller (would prod the HAL mic gain — unreliable on macOS).
            gain_controller: Some(GainController::GainController2(GainController2 {
                adaptive_digital: Some(AdaptiveDigital::default()),
                ..Default::default()
            })),
            echo_canceller: None,
            ..Default::default()
        };
        processor.set_config(config);
        Ok(processor)
    }

    /// Run a single 10 ms mono frame through APM in place. `frame` MUST be
    /// exactly `APM_FRAME_SAMPLES` long — APM panics otherwise (see the
    /// crate's `process_capture_frame` doc-comment).
    ///
    /// The WebRTC API takes a non-interleaved `[channel][sample]` layout, so
    /// for our mono path we wrap the buffer in a one-element Vec, hand it
    /// over, and copy the processed samples back out. The intermediate alloc
    /// is cheap (Vec of one Vec) compared to APM's own internal work per
    /// frame.
    pub fn process_mono(processor: &Processor, frame: &mut [f32]) -> Result<(), String> {
        debug_assert_eq!(frame.len(), APM_FRAME_SAMPLES);
        let mut channels: Vec<Vec<f32>> = vec![frame.to_vec()];
        processor
            .process_capture_frame(&mut channels)
            .map_err(|e| format!("apm process: {e:?}"))?;
        frame.copy_from_slice(&channels[0]);
        Ok(())
    }
}

#[cfg(target_os = "windows")]
mod imp {
    // Pass-through APM for Windows. The `webrtc-audio-processing` crate's
    // bundled C++ build is Unix-only (it can't be linked under MSVC), so on
    // Windows we don't run AGC2 / noise-suppression / HPF yet. Frames pass
    // through untouched; the rest of the segmenter pipeline (Silero VAD,
    // speaker gate, Whisper) is unaffected. A pure-Rust front end can be
    // dropped in here later without touching `audio.rs`.

    /// Stand-in for `webrtc_audio_processing::Processor`. Zero-sized; holds
    /// no state because the Windows path performs no processing.
    pub struct Processor;

    pub fn build() -> Result<Processor, String> {
        Ok(Processor)
    }

    pub fn process_mono(_processor: &Processor, _frame: &mut [f32]) -> Result<(), String> {
        // No-op: leave the frame exactly as captured.
        Ok(())
    }
}

pub use imp::{build, process_mono, Processor};
