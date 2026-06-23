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
