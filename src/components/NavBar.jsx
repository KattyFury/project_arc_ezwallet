import { useNav } from '../nav'
import Icon from '../components/Icon'

// THE NAVBAR - redrawn 2026-09-23 from Figma node 1:328 ("Send") and its siblings.
//
// ⚠️ IT NO LONGER HAS A BAR. The old version was a grey strip with a white "cell" behind the active tab
// and an inset shadow along its top edge; the redesign puts the four items STRAIGHT ONTO THE SCREEN'S
// GRADIENT with no background of any kind. Do not reintroduce a surface behind it.
//
// Geometry, straight off the node: four equal 97.5px columns, so the centres fall on 48.75 / 146.25 /
// 243.75 / 341.25 of 390 - i.e. 12.5% / 37.5% / 62.5% / 87.5%. The 24px icon sits at y=783 and the 16px
// semibold label at y=809.
// ICON ONLY since 2026-09-27 (user decision: "ICON + TEXT thành ICON") - the label is gone from view but
// kept as aria-label for screen readers; the icon is centred in row 10 at 30px (up from 24, filling the
// space the label left). Active = black, inactive = the card grey #F1F4FA (NOT the app's --color-muted:
// on this gradient a muted slate would disappear into the blue).
const TABS = [
  { id: 'ServiceHub',  label: 'Services', icon: 'hub',  left: '12.5%' },
  { id: 'HomeSend',    label: 'Send',     icon: 'up',   left: '37.5%' },
  { id: 'HomeReceive', label: 'Receive',  icon: 'down', left: '62.5%' },
  { id: 'MenuScreen',  label: 'Menu',     icon: 'menu', left: '87.5%' },
]

export default function NavBar({ active }) {
  const { navigate } = useNav()
  return (
    <nav>
      {TABS.map(tab => {
        const on = active === tab.id
        const color = on ? 'var(--color-black)' : 'var(--color-card)'
        return (
          <button
            key={tab.id}
            onClick={() => navigate(tab.id)}
            aria-current={on ? 'page' : undefined}
            style={{
              // THE BUTTON IS THE WHOLE OF ROW 10 (774-844 of 844 = 91.71dvh, 70 tall) and centres its
              // icon+label block inside it, rather than being pinned by the block's own top edge.
              // User correction 2026-09-23: "dời icon và chữ xuống một tí, cho ra trung tâm hàng 10".
              // Pinning the top left the ~45px block sitting at 783-828, i.e. centred on 805.5 when
              // row 10's centre is 809. Owning the row means the maths cannot drift again.
              // height 8.29dvh (= 70/844), not a fixed 70px, so on any phone the icon stays centred in the
              // strip under the sheet, which also scales with the viewport (fix 2026-09-27).
              position: 'absolute', left: tab.left, top: '91.71dvh', height: '8.29dvh',
              transform: 'translateX(-50%)', width: '25%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'none', border: 'none', padding: 0, cursor: 'pointer',
              WebkitTapHighlightColor: 'transparent',
            }}
            aria-label={tab.label}>
            <Icon name={tab.icon} size="calc(30 * var(--u))" color={color} />
          </button>
        )
      })}
    </nav>
  )
}
