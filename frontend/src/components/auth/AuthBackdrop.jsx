// Decorative backdrop used only by Landing/Login/Register — deliberately not
// part of the shared design system (src/components/shared/), since every other
// page in the app keeps the flat black-on-white look.

// layered radial + linear gradient from the five pastel palette colors —
// CSS-generated so there's zero file weight and it scales to any viewport
const GRADIENT_BACKGROUND = `
  radial-gradient(circle at 15% 20%, #ECC9B3 0%, transparent 45%),
  radial-gradient(circle at 85% 15%, #CDDDE7 0%, transparent 50%),
  radial-gradient(circle at 75% 80%, #F4CFB7 0%, transparent 50%),
  radial-gradient(circle at 20% 85%, #DCCECD 0%, transparent 45%),
  linear-gradient(135deg, #F4CFB7 0%, #E4C3B7 35%, #CDDDE7 100%)
`;

const AuthBackdrop = ({ className = '', children }) => (
  <div className={`relative overflow-hidden ${className}`}>
    <div className="absolute inset-0" style={{ background: GRADIENT_BACKGROUND }} />
    {/* blurs the gradient layer it sits in front of, not the content above it —
        backdrop-filter only blurs what's visible through the element, never its own children */}
    <div className="absolute inset-0 backdrop-blur-[60px]" />
    {/* absolute+inset-0 rather than relative+h-full — percentage heights don't
        reliably resolve against a parent sized by min-height alone (e.g. on
        Login/Register, the parent only has min-h-screen, not a fixed height) */}
    {children && <div className="absolute inset-0 z-10">{children}</div>}
  </div>
);

export default AuthBackdrop;
