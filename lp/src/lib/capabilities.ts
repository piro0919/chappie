import {
  AlarmClock,
  AppWindow,
  BatteryMedium,
  Camera,
  ClipboardCopy,
  Clock,
  CloudSun,
  Globe,
  Hand,
  MessageCircle,
  type Mic,
  Music,
  NotebookPen,
  Timer,
  Volume2,
} from "lucide-react";

export const CAPABILITY_IDS = [
  "chat",
  "timer",
  "reminder",
  "time",
  "weather",
  "web",
  "apps",
  "volume",
  "music",
  "clipboard",
  "screenshot",
  "notes",
  "battery",
  "goodbye",
] as const;

export type CapabilityId = (typeof CAPABILITY_IDS)[number];

export const HERO_CAPABILITY_IDS: readonly CapabilityId[] = [
  "chat",
  "timer",
  "weather",
  "clipboard",
];

export const CAPABILITY_ICONS: Record<CapabilityId, typeof Mic> = {
  chat: MessageCircle,
  timer: Timer,
  time: Clock,
  weather: CloudSun,
  web: Globe,
  apps: AppWindow,
  volume: Volume2,
  music: Music,
  clipboard: ClipboardCopy,
  screenshot: Camera,
  reminder: AlarmClock,
  notes: NotebookPen,
  battery: BatteryMedium,
  goodbye: Hand,
};

export const CAPABILITY_EXAMPLE_KEYS: Record<CapabilityId, string[]> = {
  chat: ["example1", "example2"],
  timer: ["example1", "example2", "example3"],
  time: ["example1", "example2", "example3"],
  weather: ["example1", "example2", "example3"],
  web: ["example1", "example2", "example3"],
  apps: ["example1", "example2", "example3"],
  volume: ["example1", "example2", "example3"],
  clipboard: ["example1", "example2", "example3"],
  screenshot: ["example1", "example2", "example3"],
  reminder: ["example1", "example2", "example3"],
  music: ["example1", "example2", "example3"],
  notes: ["example1", "example2", "example3"],
  battery: ["example1", "example2", "example3"],
  goodbye: ["example1", "example2", "example3"],
};
