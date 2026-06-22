/**
 * src/components/shared/Input.jsx
 *
 * Flat, 1px-bordered text input — no rounded-pill shapes, no inner
 * shadows, no colored focus glow beyond the standard accessible focus
 * ring already defined globally in index.css. Designed to pair directly
 * with react-hook-form's register() pattern.
 *
 * Usage with react-hook-form:
 *   <Input
 *     label="Email"
 *     error={errors.email?.message}
 *     {...register('email', { required: 'Email is required' })}
 *   />
 */

const Input = ({ label, error, type = 'text', className = '', ...rest }) => {
  return (
    <div className={className}>
      {label && (
        <label className="block text-sm font-medium text-text mb-1">
          {label}
        </label>
      )}
      <input
        type={type}
        className={`
          w-full px-3 py-2 text-sm font-body
          border rounded-sm bg-white text-text
          placeholder:text-text-muted
          ${error ? 'border-danger' : 'border-border'}
        `}
        {...rest}
      />
      {error && (
        <p className="mt-1 text-xs text-danger">{error}</p>
      )}
    </div>
  );
};

export default Input;
