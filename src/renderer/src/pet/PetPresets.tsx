import type { PetPresetId } from '../../../shared/types'

export function PetPresetAvatar({ presetId }: { presetId: PetPresetId }): JSX.Element {
  switch (presetId) {
    case 'cat':
      return (
        <svg viewBox="0 0 200 200" width="100%" height="100%" fill="none">
          {/* 耳朵 */}
          <path d="M42 82 L32 28 L82 54 Z" fill="#f8fafc" stroke="#334155" strokeWidth="5" strokeLinejoin="round" />
          <path d="M46 72 L39 38 L72 56 Z" fill="#fda4af" />
          <path d="M158 82 L168 28 L118 54 Z" fill="#f8fafc" stroke="#334155" strokeWidth="5" strokeLinejoin="round" />
          <path d="M154 72 L161 38 L128 56 Z" fill="#fda4af" />
          {/* 耳机头梁 */}
          <path d="M30 98 A70 70 0 0 1 170 98" stroke="#38bdf8" strokeWidth="10" strokeLinecap="round" />
          {/* 脸部 */}
          <ellipse cx="100" cy="108" rx="64" ry="56" fill="#ffffff" stroke="#334155" strokeWidth="5" />
          {/* 耳机耳罩 */}
          <rect x="20" y="84" width="22" height="44" rx="11" fill="#0ea5e9" stroke="#334155" strokeWidth="4" />
          <rect x="158" y="84" width="22" height="44" rx="11" fill="#0ea5e9" stroke="#334155" strokeWidth="4" />
          {/* 眼睛 */}
          <circle cx="74" cy="104" r="9" fill="#1e293b" />
          <circle cx="71" cy="101" r="3.5" fill="#ffffff" />
          <circle cx="126" cy="104" r="9" fill="#1e293b" />
          <circle cx="123" cy="101" r="3.5" fill="#ffffff" />
          {/* 腮红 */}
          <ellipse cx="56" cy="118" rx="10" ry="6" fill="#fecdd3" />
          <ellipse cx="144" cy="118" rx="10" ry="6" fill="#fecdd3" />
          {/* 鼻子与猫嘴 */}
          <polygon points="100,115 95,109 105,109" fill="#fb7185" />
          <path d="M88 122 Q94 129 100 121 Q106 129 112 122" stroke="#334155" strokeWidth="4" strokeLinecap="round" fill="none" />
          {/* 小爪子与音符 */}
          <ellipse cx="76" cy="162" rx="14" ry="10" fill="#ffffff" stroke="#334155" strokeWidth="4" />
          <ellipse cx="124" cy="162" rx="14" ry="10" fill="#ffffff" stroke="#334155" strokeWidth="4" />
          <text x="152" y="42" fontSize="24" fill="#38bdf8">♪</text>
          <text x="20" y="52" fontSize="20" fill="#f472b6">♫</text>
        </svg>
      )
    case 'robot':
      return (
        <svg viewBox="0 0 200 200" width="100%" height="100%" fill="none">
          {/* 天线 */}
          <line x1="100" y1="24" x2="100" y2="48" stroke="#64748b" strokeWidth="6" strokeLinecap="round" />
          <circle cx="100" cy="20" r="9" fill="#38bdf8" />
          {/* 头部外壳 */}
          <rect x="38" y="48" width="124" height="104" rx="28" fill="#f1f5f9" stroke="#334155" strokeWidth="5" />
          {/* 侧耳发光模块 */}
          <rect x="24" y="80" width="14" height="40" rx="6" fill="#818cf8" stroke="#334155" strokeWidth="4" />
          <rect x="162" y="80" width="14" height="40" rx="6" fill="#818cf8" stroke="#334155" strokeWidth="4" />
          {/* 屏幕面罩 */}
          <rect x="52" y="66" width="96" height="64" rx="16" fill="#0f172a" />
          {/* 发光电子眼 */}
          <circle cx="78" cy="96" r="10" fill="#38bdf8" />
          <circle cx="75" cy="93" r="3" fill="#ffffff" />
          <circle cx="122" cy="96" r="10" fill="#38bdf8" />
          <circle cx="119" cy="93" r="3" fill="#ffffff" />
          {/* 声波微笑线 */}
          <path d="M84 114 Q100 124 116 114" stroke="#34d399" strokeWidth="4" strokeLinecap="round" />
          {/* 底部悬浮底座 */}
          <ellipse cx="100" cy="170" rx="38" ry="8" fill="#38bdf8" opacity="0.45" />
        </svg>
      )
    case 'fox':
      return (
        <svg viewBox="0 0 200 200" width="100%" height="100%" fill="none">
          {/* 狐狸大耳朵 */}
          <path d="M36 90 L26 22 L84 56 Z" fill="#fb923c" stroke="#334155" strokeWidth="5" strokeLinejoin="round" />
          <path d="M44 76 L36 36 L74 58 Z" fill="#fef3c7" />
          <path d="M164 90 L174 22 L116 56 Z" fill="#fb923c" stroke="#334155" strokeWidth="5" strokeLinejoin="round" />
          <path d="M156 76 L164 36 L126 58 Z" fill="#fef3c7" />
          {/* 狐狸脸 */}
          <ellipse cx="100" cy="110" rx="64" ry="54" fill="#fb923c" stroke="#334155" strokeWidth="5" />
          {/* 白色脸颊区域 */}
          <path d="M38 116 Q70 98 100 132 Q130 98 162 116 A62 50 0 0 1 38 116 Z" fill="#fffbeb" />
          {/* 弯弯笑眼 */}
          <path d="M64 100 Q74 88 84 100" stroke="#1e293b" strokeWidth="5" strokeLinecap="round" fill="none" />
          <path d="M116 100 Q126 88 136 100" stroke="#1e293b" strokeWidth="5" strokeLinecap="round" fill="none" />
          {/* 腮红与鼻子 */}
          <ellipse cx="56" cy="115" rx="9" ry="5" fill="#fda4af" />
          <ellipse cx="144" cy="115" rx="9" ry="5" fill="#fda4af" />
          <circle cx="100" cy="122" r="6" fill="#1e293b" />
          <path d="M92 132 Q100 139 108 132" stroke="#334155" strokeWidth="4" strokeLinecap="round" fill="none" />
          <text x="154" y="46" fontSize="22" fill="#f472b6">♪</text>
        </svg>
      )
    case 'headphone':
    default:
      return (
        <svg viewBox="0 0 200 200" width="100%" height="100%" fill="none">
          <circle cx="100" cy="108" r="56" fill="#e0f2fe" stroke="#0284c7" strokeWidth="5" />
          <path d="M36 104 A64 64 0 0 1 164 104" stroke="#0f172a" strokeWidth="12" strokeLinecap="round" />
          <rect x="22" y="88" width="24" height="50" rx="12" fill="#ec4899" stroke="#0f172a" strokeWidth="4" />
          <rect x="154" y="88" width="24" height="50" rx="12" fill="#ec4899" stroke="#0f172a" strokeWidth="4" />
          <circle cx="80" cy="104" r="7" fill="#0f172a" />
          <circle cx="120" cy="104" r="7" fill="#0f172a" />
          <path d="M86 124 Q100 136 114 124" stroke="#0f172a" strokeWidth="5" strokeLinecap="round" fill="none" />
          <text x="148" y="42" fontSize="24" fill="#ec4899">♫</text>
        </svg>
      )
  }
}
