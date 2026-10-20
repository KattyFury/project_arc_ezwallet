// Shared icon component. SAME API as before - `<Icon name="qr" size={24} color="..." />` - so switching
// the whole app's icon set is this one file and NOT a change to any of the ~20 screens that render icons.
//
// 2026-09-23: the app moved from the user's 37 hand-drawn SVGs in `icon/` to LUCIDE (user decision:
// "thư viện icon dùng 1 thư viện lớn, đẹp" → Lucide, replace everything). Lucide is ~6,300 icons, MIT,
// 24px grid / 2px stroke, and it tree-shakes: only the icons named below are bundled, not the library.
//
// ⚠️ THE `icon/` FOLDER IS DELIBERATELY NOT DELETED. Those are the user's own drawings and nothing
// imports them any more, but they are the fallback if a Lucide glyph turns out wrong on a real device,
// and they are not ours to throw away. (`luckypot.svg` IS gone - that feature was removed.)
//
// ⚠️ THE MAPPING BELOW WAS MADE BY LOOKING AT EVERY OLD GLYPH, NOT BY MATCHING NAMES. Several old names
// lie about their shape: `right2` was a solid PLAY TRIANGLE used as a chevron, `down2` was a solid
// DOWN TRIANGLE used as a dropdown caret, `trade` and `exchange` were both up/down arrow pairs, and `qr`
// was four squares rather than a QR code. Each is mapped to what it DID, not to what it was called.
import {
  Plus,             // add       - a thin plus
  CircleCheck,      // check     - tick inside a circle (the Receipt's big success mark)
  Clock,            // clock
  Copy,             // copy      - two overlapping squares
  ArrowDown,        // down      - a plain down arrow (money received)
  ChevronDown,      // down2     - WAS a solid triangle; it is a dropdown caret, so a chevron is the honest shape
  Download,         // download  - arrow into a tray
  Delete,           // erase     - backspace key with an x (the numpad)
  RefreshCcwDot,    // exchange  - a circular arrow around a dot (Service hub Exchange card, owner 2026-10-05; was ArrowUpDown)
  Rocket,           // memes     - a rocket (Service hub Memes card, 2026-10-05)
  HandCoins,        // lending   - a hand holding coins (Service hub Lending / Borrow card, owner 2026-10-05)
  Globe,            // globe
  LayoutGrid,       // hub       - 2x2 rounded squares (the Services tab)
  User,             // human     - a person (Contacts)
  Info,             // info
  Mail,             // mail
  Menu,             // menu      - hamburger
  EllipsisVertical, // option    - three vertical dots
  LogOut,           // out       - arrow leaving a bracket (Sign out / Exit)
  Pencil,           // pencil
  QrCode,           // qr        - WAS four plain squares; the thing it means is a QR code
  ChevronRight,     // right2    - WAS a solid play triangle, used as a row chevron
  Scan,             // scan      - viewfinder corners
  Share2,           // share     - three connected nodes
  Shield,           // shield
  ArrowUpDown as TradeArrows, // trade - an up/down arrow pair, drawn heavier (Swap's reverse button)
  ArrowUp,          // up        - a plain up arrow (money sent)
  Send,             // send      - a paper plane (the Send button on each Contacts row, 2026-10-03)
  ArrowUpFromLine,  // withdraw  - arrow leaving a line (Menu Withdraw; owner picked option B 2026-10-03 - plain ↑ clashed with Send)
  ArrowDownToLine,  // deposit   - arrow landing on a line (Menu Deposit; plain ↓ clashed with Receive)
  CircleAlert,      // warning   - an exclamation mark inside a circle
  X,                // x         - a plain cross
  // New with the 2026-09-23 redesign - the fake iOS share sheet on the Add screen needs Apple's own
  // five rows, so these match what iOS actually draws (see the user's screenshot of the real sheet).
  BookOpen,         // Add Bookmark to...  - an open book
  Star,             // Add to Favorites    - an outlined star
  NotepadText,      // Add to Quick Note   - a note pad
  FileSearch,       // Find on Page        - a document with a magnifier
  SquarePlus,       // Add to Home Screen  - a plus inside a rounded square
} from 'lucide-react'

const ICONS = {
  add: Plus,
  book: BookOpen,     // Learn about blockchain (Menu row) - same glyph as `bookmark`, different meaning
  check: CircleCheck,
  clock: Clock,
  copy: Copy,
  down: ArrowDown,
  down2: ChevronDown,
  download: Download,
  erase: Delete,
  exchange: RefreshCcwDot,
  lending: HandCoins,
  memes: Rocket,
  globe: Globe,
  hub: LayoutGrid,
  human: User,
  info: Info,
  mail: Mail,
  menu: Menu,
  option: EllipsisVertical,
  out: LogOut,
  pencil: Pencil,
  qr: QrCode,
  right2: ChevronRight,
  scan: Scan,
  send: Send,
  withdraw: ArrowUpFromLine,
  deposit: ArrowDownToLine,
  share: Share2,
  shield: Shield,
  trade: TradeArrows,
  up: ArrowUp,
  warning: CircleAlert,
  x: X,
  // the Add screen's share sheet
  bookmark: BookOpen,
  star: Star,
  note: NotepadText,
  find: FileSearch,
  addSquare: SquarePlus,
}

export default function Icon({ name, size = 24, color, style, className }) {
  const Glyph = ICONS[name]
  if (!Glyph) return null
  // `color` stays optional exactly as before: unset → the glyph inherits the parent's text colour,
  // which is what every call site that omits it already relies on.
  return (
    <span
      className={className}
      style={{ display: 'inline-flex', width: size, height: size, color, flexShrink: 0, ...style }}>
      {/* A CSS-string size (var(--is-*) or calc(N * var(--u))) is valid on the span but NOT as an SVG
          width/height attribute - so the glyph fills the span instead. Numbers pass through unchanged. */}
      <Glyph size={typeof size === 'number' ? size : '100%'} color="currentColor" absoluteStrokeWidth={false} />
    </span>
  )
}
