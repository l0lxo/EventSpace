/**
 * src/components/shared/Button.jsx
 *
 * Every clickable action button in the app should use this component
 * rather than a raw <button> with one-off Tailwind classes. This is what
 * keeps every button across 20+ pages looking identical — same height,
 * same radius, same hover behavior — instead of drifting apart as the
 * app grows.
 *
 * Usage:
 *   <Button>Save changes</Button>
 *   <Button variant="secondary">Cancel</Button>
 *   <Button variant="danger">Delete</Button>
 *   <Button variant="ghost" size="sm">View</Button>
 *   <Button isLoading>Submitting...</Button>
 */

const VARIANT_STYLES = {
  primary: 'bg-accent text-white border border-accent hover:bg-accent-hover',
  secondary: 'bg-white text-text border border-border hover:bg-surface',
  danger: 'bg-white text-danger border border-danger hover:bg-danger-bg',
  ghost: 'bg-transparent text-accent border border-transparent hover:bg-surface',
};

const SIZE_STYLES = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2 text-sm',
  lg: 'px-5 py-2.5 text-base',
};

const Button = ({
  children,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  disabled = false,
  type = 'button',
  onClick,
  className = '',
  ...rest
}) => {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || isLoading}
      className={`
        font-medium rounded-sm transition-colors duration-150
        disabled:opacity-50 disabled:cursor-not-allowed
        ${VARIANT_STYLES[variant]}
        ${SIZE_STYLES[size]}
        ${className}
      `}
      {...rest}
    >
      {isLoading ? 'Please wait…' : children}
    </button>
  );
};

export default Button;
