/**
 * src/components/shared/Select.jsx
 *
 * Used for the category dropdown, role selector, and any other fixed-enum
 * field. Same flat visual treatment as Input — keeps forms feeling like
 * one coherent system rather than a mix of native and custom-styled controls.
 *
 * Usage:
 *   <Select label="Category" {...register('category')}>
 *     <option value="">Select a category</option>
 *     <option value="Technology">Technology</option>
 *   </Select>
 */

const Select = ({ label, error, children, className = '', ...rest }) => {
  return (
    <div className={className}>
      {label && (
        <label className="block text-sm font-medium text-text mb-1">
          {label}
        </label>
      )}
      <select
        className={`
          w-full px-3 py-2 text-sm font-body
          border rounded-sm bg-white text-text
          ${error ? 'border-danger' : 'border-border'}
        `}
        {...rest}
      >
        {children}
      </select>
      {error && (
        <p className="mt-1 text-xs text-danger">{error}</p>
      )}
    </div>
  );
};

export default Select;
