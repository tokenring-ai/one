//! Loading-screen decoration: the braille spinner, rotating "ridiculous"
//! messages, and the three width-adaptive ASCII banners. Ported from
//! `pkg/utility/string/brailleSpinner.ts`, `ridiculousMessages.ts`, and
//! `backend/banner.*.txt`.

use crate::tui::text::visible_len;

/// The braille spinner frames (`brailleSpinner.ts`).
pub const BRAILLE_SPINNER: [&str; 10] = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

/// The rotating loading messages (`ridiculousMessages.ts`).
pub const RIDICULOUS_MESSAGES: &[&str] = &[
    "Reticulating splines",
    "Charging flux capacitor",
    "Herding cats",
    "Downloading more RAM",
    "Inverting the binary tree",
    "Feeding the hamsters",
    "Spooling the FTL drive",
    "Calibrating the warp manifold",
    "Recalculating orbital trajectories",
    "Venturing beyond the Event Horizon",
    "Aligning the Dyson Sphere panels",
    "Consulting the Galactic Encyclopedia",
    "Stabilizing the wormhole aperture",
    "Priming the ion thrusters",
    "Decoding transmissions from Sector 7G",
    "Synchronizing with the pulsar's frequency",
    "Harvesting dark matter from the void",
    "Refueling at the nearest Red Giant",
    "Patching the hull breaches with space-tape",
    "Engaging the inertial dampeners",
    "Mapping the Oort Cloud",
    "Rerouting power from life support to Shields",
    "Translating 'Klingon' to 'JavaScript'",
    "Evading the Borg collective",
    "Calculating the Kessel Run in parsecs",
    "Tuning the subspace transceiver",
    "Initiating the countdown to liftoff",
    "Tuning the subspace transceiver",
    "Initiating the countdown to liftoff",
    "Adjusting the gravity plating",
    "Navigating the asteroid belt",
    "Scanning for signs of intelligent life",
    "Purging the plasma conduits",
    "Collapsing the wave function",
    "Escaping the gravity well",
    "Establishing a secure uplink to Starfleet",
    "Converting coffee into rocket fuel",
    "Setting phasers to 'Deploy'",
    "Recharging the dilithium crystals",
    "Observing the heat death of the universe",
    "Bypassing the main deflector dish",
    "Correcting the space-time continuum",
    "Docking with the International Space Station",
    "Analyzing Martian soil samples",
    "Calculating the Schwarzschild radius",
    "Summoning the Great Old Ones from the void",
    "Jumping to lightspeed",
    "Ignoring the laws of physics",
    "Expanding the observable universe",
];

/// The single-line brand banner shown in headers (`screenBanner`).
pub const SCREEN_BANNER: &str = "TokenRing";

/// Pick the message for a given render tick (`getRandomItem(msgs, tick / 10)`).
pub fn spinner_message(tick: usize) -> &'static str {
    let index = (tick / 10) % RIDICULOUS_MESSAGES.len();
    RIDICULOUS_MESSAGES[index]
}

/// The spinner frame for a given render tick.
pub fn spinner_frame(tick: usize) -> &'static str {
    BRAILLE_SPINNER[tick % BRAILLE_SPINNER.len()]
}

pub const BANNER_COMPACT: &str = "\
████████╗ ██████╗ ██╗  ██╗███████╗███╗   ██╗
╚══██╔══╝██╔═══██╗██║ ██╔╝██╔════╝████╗  ██║
   ██║   ██║   ██║█████╔╝ █████╗  ██╔██╗ ██║
   ██║   ██║   ██║██╔═██╗ ██╔══╝  ██║╚██╗██║
   ██║   ╚██████╔╝██║  ██╗███████╗██║ ╚████║
   ╚═╝    ╚═════╝ ╚═╝  ╚═╝╚══════╝╚═╝  ╚═══╝

       ██████╗ ██╗███╗   ██╗ ██████╗
       ██╔══██╗██║████╗  ██║██╔════╝
       ██████╔╝██║██╔██╗ ██║██║  ███╗
       ██╔══██╗██║██║╚██╗██║██║   ██║
       ██║  ██╗██║██║ ╚████║╚██████╔╝
       ╚═╝  ╚═╝╚═╝╚═╝  ╚═══╝ ╚═════╝";

pub const BANNER_NARROW: &str = "\
████████╗ ██████╗ ██╗  ██╗███████╗███╗   ██╗██████╗ ██╗███╗   ██╗ ██████╗
╚══██╔══╝██╔═══██╗██║ ██╔╝██╔════╝████╗  ██║██╔══██╗██║████╗  ██║██╔════╝
   ██║   ██║   ██║█████╔╝ █████╗  ██╔██╗ ██║██████╔╝██║██╔██╗ ██║██║  ███╗
   ██║   ██║   ██║██╔═██╗ ██╔══╝  ██║╚██╗██║██╔══██╗██║██║╚██╗██║██║   ██║
   ██║   ╚██████╔╝██║  ██╗███████╗██║ ╚████║██║  ██╗██║██║ ╚████║╚██████╔╝
   ╚═╝    ╚═════╝ ╚═╝  ╚═╝╚══════╝╚═╝  ╚═══╝╚═╝  ╚═╝╚═╝╚═╝  ╚═══╝ ╚═════╝

                       ██████╗ ███╗   ██╗███████╗
                      ██╔═══██╗████╗  ██║██╔════╝
                      ██║   ██║██╔██╗ ██║█████╗
                      ██║   ██║██║╚██╗██║██╔══╝
                      ╚██████╔╝██║ ╚████║███████╗
                       ╚═════╝ ╚═╝  ╚═══╝╚══════╝";

pub const BANNER_WIDE: &str = "\
████████╗ ██████╗ ██╗  ██╗███████╗███╗   ██╗██████╗ ██╗███╗   ██╗ ██████╗      ██████╗ ███╗   ██╗███████╗
╚══██╔══╝██╔═══██╗██║ ██╔╝██╔════╝████╗  ██║██╔══██╗██║████╗  ██║██╔════╝     ██╔═══██╗████╗  ██║██╔════╝
   ██║   ██║   ██║█████╔╝ █████╗  ██╔██╗ ██║██████╔╝██║██╔██╗ ██║██║  ███╗    ██║   ██║██╔██╗ ██║█████╗
   ██║   ██║   ██║██╔═██╗ ██╔══╝  ██║╚██╗██║██╔══██╗██║██║╚██╗██║██║   ██║    ██║   ██║██║╚██╗██║██╔══╝
   ██║   ╚██████╔╝██║  ██╗███████╗██║ ╚████║██║  ██╗██║██║ ╚████║╚██████╔╝    ╚██████╔╝██║ ╚████║███████╗
   ╚═╝    ╚═════╝ ╚═╝  ╚═╝╚══════╝╚═╝  ╚═══╝╚═╝  ╚═╝╚═╝╚═╝  ╚═══╝ ╚═════╝      ╚═════╝ ╚═╝  ╚═══╝╚══════╝";

/// Choose the banner lines for the current terminal width (`formatBanner`).
/// `width > wideMax` → wide; `width > narrowMax` → narrow; else compact.
pub fn banner_lines(width: usize) -> Vec<String> {
    let wide_max = BANNER_WIDE.lines().map(visible_len).max().unwrap_or(0);
    let narrow_max = BANNER_NARROW.lines().map(visible_len).max().unwrap_or(0);
    let banner = if width > wide_max {
        BANNER_WIDE
    } else if width > narrow_max {
        BANNER_NARROW
    } else {
        BANNER_COMPACT
    };
    let lines: Vec<&'static str> = banner.lines().collect();
    let max_line_width = lines.iter().map(|line| visible_len(line)).max().unwrap_or(0);

    lines
        .into_iter()
        .map(|line| {
            let len = visible_len(line);
            let mut padded = line.to_string();
            if len < max_line_width {
                padded.push_str(&" ".repeat(max_line_width - len));
            }
            padded
        })
        .collect()
}