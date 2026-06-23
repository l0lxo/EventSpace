const Card = ({ children, className = '', ...rest }) => {
  return (
    <div
      className={`
        bg-white border border-border rounded-md p-5
        ${className}
      `}
      {...rest}
    >
      {children}
    </div>
  );
};

export default Card;
