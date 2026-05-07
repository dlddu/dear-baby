import { ReactNode } from "react"

// ─────────────────────────────────────────────────────────────────────────────
// TopBar
// ─────────────────────────────────────────────────────────────────────────────
export function TopBar({
  title,
  right,
  transparent = false,
}: {
  title?: string
  right?: ReactNode
  transparent?: boolean
}) {
  return (
    <div
      className={
        "flex items-center px-4 pt-1 pb-1 " + (transparent ? "bg-transparent" : "bg-inherit")
      }
    >
      <button className="w-10 h-10 flex items-center justify-center text-[22px] text-ink/80">
        ←
      </button>
      <div className="flex-1 text-center text-[15px] font-semibold text-ink">{title}</div>
      <div className="w-10 flex items-center justify-end">{right ?? null}</div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Tabbar (sticky bottom)
// ─────────────────────────────────────────────────────────────────────────────
export function Tabbar({
  active = "home",
}: {
  active?: "home" | "diary" | "book" | "settings"
}) {
  const items: { id: typeof active; ic: string; label: string }[] = [
    { id: "home", ic: "🏠", label: "홈" },
    { id: "diary", ic: "📓", label: "기록" },
    { id: "book", ic: "📖", label: "책" },
    { id: "settings", ic: "⚙", label: "설정" },
  ]
  return (
    <div className="sticky bottom-0 left-0 right-0 bg-ivory/95 backdrop-blur border-t border-beige flex justify-around py-2.5 z-10">
      {items.map((t) => (
        <div
          key={t.id}
          className={
            "flex flex-col items-center gap-0.5 " +
            (t.id === active ? "text-coral" : "text-ink-muted")
          }
        >
          <div className="text-[20px]">{t.ic}</div>
          <div className="text-[10px] font-medium">{t.label}</div>
        </div>
      ))}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// BottomAction (fixed CTA at the bottom of phone screen)
// ─────────────────────────────────────────────────────────────────────────────
export function BottomAction({
  children,
  className = "",
}: {
  children: ReactNode
  className?: string
}) {
  return <div className={"px-5 pt-3 pb-6 " + className}>{children}</div>
}

// ─────────────────────────────────────────────────────────────────────────────
// PrimaryButton
// ─────────────────────────────────────────────────────────────────────────────
export function PrimaryButton({
  children,
  className = "",
  disabled,
}: {
  children: ReactNode
  className?: string
  disabled?: boolean
}) {
  return (
    <button
      disabled={disabled}
      className={
        "w-full h-14 rounded-full font-semibold text-[15px] shadow-db-md active:scale-[0.99] transition-transform " +
        (disabled ? "bg-beige text-ink-muted cursor-not-allowed" : "bg-coral text-white") +
        " " +
        className
      }
    >
      {children}
    </button>
  )
}

export function SecondaryButton({
  children,
  className = "",
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <button
      className={
        "w-full h-14 rounded-full font-semibold text-[15px] bg-beige text-ink active:scale-[0.99] transition-transform " +
        className
      }
    >
      {children}
    </button>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Badge
// ─────────────────────────────────────────────────────────────────────────────
export function Badge({
  children,
  variant = "coral",
}: {
  children: ReactNode
  variant?: "coral" | "soft" | "gold" | "sage" | "week"
}) {
  const map = {
    coral: "bg-coral text-white",
    soft: "bg-cream text-ink",
    gold: "bg-gold text-white",
    sage: "bg-sage text-white",
    week: "bg-coral text-white",
  }
  return (
    <span
      className={
        "inline-flex items-center px-3 py-1 rounded-full text-[12px] font-semibold tracking-wide " +
        map[variant]
      }
    >
      {children}
    </span>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// FrameCard — basic ivory card
// ─────────────────────────────────────────────────────────────────────────────
export function FrameCard({
  children,
  className = "",
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div className={"bg-ivory rounded-db-md shadow-db-sm " + className}>{children}</div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Chip / Pill
// ─────────────────────────────────────────────────────────────────────────────
export function Chip({
  children,
  selected = false,
}: {
  children: ReactNode
  selected?: boolean
}) {
  return (
    <span
      className={
        "px-3.5 py-1.5 rounded-full text-[13px] font-medium border " +
        (selected
          ? "bg-coral text-white border-coral"
          : "bg-beige text-ink border-transparent")
      }
    >
      {children}
    </span>
  )
}

export function Pill({
  children,
  selected = false,
}: {
  children: ReactNode
  selected?: boolean
}) {
  return (
    <span
      className={
        "px-4 py-2 rounded-db-sm text-[13px] font-semibold " +
        (selected ? "bg-coral text-white" : "bg-cream text-ink-sub")
      }
    >
      {children}
    </span>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// FieldLabel
// ─────────────────────────────────────────────────────────────────────────────
export function FieldLabel({ children }: { children: ReactNode }) {
  return (
    <div className="text-[14px] font-semibold text-ink pl-1 mb-2">{children}</div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// QuestionHeader (large heading + helper)
// ─────────────────────────────────────────────────────────────────────────────
export function QuestionHeader({
  eyebrow,
  title,
  helper,
  centered = false,
}: {
  eyebrow?: string
  title: string | ReactNode
  helper?: string | ReactNode
  centered?: boolean
}) {
  return (
    <div className={"px-6 pt-4 pb-3 " + (centered ? "text-center" : "")}>
      {eyebrow && (
        <div
          className={
            "text-[12px] font-semibold text-coral tracking-[0.1em] uppercase mb-2 " +
            (centered ? "" : "")
          }
        >
          {eyebrow}
        </div>
      )}
      <div className="font-serif text-[22px] font-bold leading-[1.45] text-ink mb-2">
        {title}
      </div>
      {helper && <div className="text-[14px] leading-[1.6] text-ink-sub">{helper}</div>}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// ProgressDots (top progress for onboarding)
// ─────────────────────────────────────────────────────────────────────────────
export function ProgressDots({ total, current }: { total: number; current: number }) {
  return (
    <div className="flex items-center gap-1.5 px-6 pt-3">
      {Array.from({ length: total }).map((_, i) => (
        <span
          key={i}
          className={
            "h-1.5 rounded-full transition-all " +
            (i < current
              ? "bg-coral w-6"
              : i === current
                ? "bg-coral w-6"
                : "bg-beige w-1.5")
          }
        />
      ))}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// StepIndicator (3 steps for book flow)
// ─────────────────────────────────────────────────────────────────────────────
export function StepIndicator({
  steps,
  current,
}: {
  steps: string[]
  current: number
}) {
  return (
    <div className="px-5 pt-2 pb-3">
      <div className="flex items-center">
        {steps.map((_, i) => (
          <div key={i} className="flex items-center flex-1 last:flex-none">
            <div
              className={
                "w-7 h-7 rounded-full flex items-center justify-center text-[12px] font-bold " +
                (i < current
                  ? "bg-sage text-white"
                  : i === current
                    ? "bg-coral text-white"
                    : "bg-beige text-ink-muted")
              }
            >
              {i < current ? "✓" : i + 1}
            </div>
            {i < steps.length - 1 && (
              <div
                className={
                  "h-[2px] flex-1 mx-1 " + (i < current ? "bg-sage" : "bg-beige")
                }
              />
            )}
          </div>
        ))}
      </div>
      <div className="flex justify-between mt-1.5 px-1">
        {steps.map((s, i) => (
          <span
            key={s}
            className={
              "text-[11px] font-medium " +
              (i === current ? "text-coral" : "text-ink-muted")
            }
          >
            {s}
          </span>
        ))}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Row (list row inside a card)
// ─────────────────────────────────────────────────────────────────────────────
export function Row({
  icon,
  iconBg = "bg-beige",
  title,
  subtitle,
  right,
  border = true,
}: {
  icon?: ReactNode
  iconBg?: string
  title: string | ReactNode
  subtitle?: string | ReactNode
  right?: ReactNode
  border?: boolean
}) {
  return (
    <div
      className={
        "flex items-center gap-3 px-4 py-3.5 " + (border ? "border-t border-beige first:border-t-0" : "")
      }
    >
      {icon && (
        <div
          className={
            "w-10 h-10 rounded-db-sm flex items-center justify-center text-[18px] flex-shrink-0 " +
            iconBg
          }
        >
          {icon}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="text-[14px] font-semibold text-ink leading-tight">{title}</div>
        {subtitle && <div className="text-[12px] text-ink-sub mt-0.5">{subtitle}</div>}
      </div>
      {right ?? <span className="text-ink-muted text-[18px]">›</span>}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// BookPage — for narrative preview / book preview
// ─────────────────────────────────────────────────────────────────────────────
export function BookPage({
  chapter,
  title,
  children,
  signature,
}: {
  chapter?: string
  title: string
  children: ReactNode
  signature?: string
}) {
  return (
    <div className="bg-[#FFFEFA] rounded-db-md p-7 shadow-db-md relative overflow-hidden">
      <div
        className="absolute top-0 left-0 right-0 h-2"
        style={{
          background: "linear-gradient(90deg, #D4836B, #F5C6A8, #D4B896, #A8C5A0)",
        }}
      />
      {chapter && (
        <div className="font-display text-[10px] text-coral tracking-[0.2em] uppercase mb-2">
          {chapter}
        </div>
      )}
      <div className="font-display text-[22px] font-bold text-ink leading-tight mb-4">
        {title}
      </div>
      <div className="font-serif text-[14px] leading-[1.85] text-ink-sub space-y-3.5">
        {children}
      </div>
      {signature && (
        <div className="font-hand text-[18px] text-coral mt-5 text-right">{signature}</div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Callout (warm)
// ─────────────────────────────────────────────────────────────────────────────
export function CalloutWarm({
  icon,
  children,
  className = "",
}: {
  icon: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={
        "flex items-start gap-3 px-4 py-3.5 rounded-db-sm bg-coral/10 border border-coral/20 " +
        className
      }
    >
      <div className="text-[18px] text-coral flex-shrink-0">{icon}</div>
      <div className="text-[13px] leading-[1.6] text-ink flex-1">{children}</div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Input (text)
// ─────────────────────────────────────────────────────────────────────────────
export function Input({
  placeholder,
  value,
  type = "text",
}: {
  placeholder?: string
  value?: string
  type?: string
}) {
  return (
    <input
      type={type}
      placeholder={placeholder}
      defaultValue={value}
      className="w-full h-12 px-4 rounded-db-sm bg-cream text-[15px] text-ink placeholder:text-ink-muted border-0 outline-none focus:ring-2 focus:ring-coral/40"
    />
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// FAB (floating action button)
// ─────────────────────────────────────────────────────────────────────────────
export function FAB({ icon = "+" }: { icon?: ReactNode }) {
  return (
    <div className="absolute right-5 bottom-[88px] w-14 h-14 rounded-full bg-coral text-white text-[28px] flex items-center justify-center shadow-db-lg z-10">
      {icon}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// BackToGallery button (rendered above PhoneFrame)
// ─────────────────────────────────────────────────────────────────────────────
export function BackToGallery({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="self-start mb-3 text-sm font-medium text-ink-sub hover:text-coral transition-colors"
    >
      ← 갤러리로
    </button>
  )
}
