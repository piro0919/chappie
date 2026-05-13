import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import {
  CAPABILITY_EXAMPLE_KEYS,
  CAPABILITY_ICONS,
  type CapabilityId,
} from "@/lib/capabilities";

export function CapabilityCard({ id }: { id: CapabilityId }): ReactNode {
  const t = useTranslations();
  const icon = CAPABILITY_ICONS[id];
  return (
    <div className="border-(--color-cream-200) flex flex-col rounded-2xl border bg-white p-6 transition-all hover:-translate-y-0.5 hover:shadow-[0_10px_24px_-12px_rgba(74,56,38,0.25)]">
      <div className="mb-4 flex items-center gap-3">
        <div
          className="bg-(--color-blush-200) inline-flex items-center justify-center rounded-2xl text-xl leading-none"
          style={{ width: 44, height: 44 }}
          aria-hidden
        >
          {icon}
        </div>
        <h3 className="text-(--color-cocoa-700) text-base font-bold">
          {t(`capabilities.items.${id}.title`)}
        </h3>
      </div>
      <ul className="mb-4 flex flex-col gap-2">
        {CAPABILITY_EXAMPLE_KEYS[id].map((k) => (
          <li
            key={k}
            className="bg-(--color-cream-100) text-(--color-cocoa-700) rounded-xl px-4 py-2 text-sm"
          >
            {t(`capabilities.items.${id}.${k}`)}
          </li>
        ))}
      </ul>
      <p className="text-(--color-cocoa-500) text-sm leading-relaxed">
        {t(`capabilities.items.${id}.body`)}
      </p>
    </div>
  );
}
