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
