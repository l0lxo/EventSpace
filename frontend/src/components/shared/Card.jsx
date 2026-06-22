/**
 * src/components/shared/Card.jsx
 *
 * A flat, bordered container — no box-shadow, no heavy elevation. Used
 * for event cards, dashboard summary tiles, and any other grouped content
 * block. The 1px border carries the visual separation instead of a shadow,
 * which is a deliberate, consistent choice across the whole app.
 *
 * Usage:
 *   <Card>...</Card>
 *   <Card className="hover:border-accent transition-colors">...</Card>
 */

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
