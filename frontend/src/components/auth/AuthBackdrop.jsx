// Decorative backdrop used only by Landing/Login/Register — deliberately not
// part of the shared design system (src/components/shared/), since every other
// page in the app keeps the flat black-on-white look.
const AuthBackdrop = ({ className = '', children }) => (
  <div
    className={`relative overflow-hidden bg-cover bg-center ${className}`}
    style={{ backgroundImage: "url('/images/auth-background.jpg')" }}
  >
    {children && <div className="absolute inset-0 z-10">{children}</div>}
  </div>
);

export default AuthBackdrop;
