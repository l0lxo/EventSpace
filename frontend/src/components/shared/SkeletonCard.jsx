const SkeletonCard = () => (
  <div className="bg-white border border-border rounded-md p-5 h-full flex flex-col" aria-hidden="true">
    <div className="w-1/3 h-3 bg-border rounded-sm mb-3 animate-skeleton-pulse" />
    <div className="w-3/4 h-4 bg-border rounded-sm mb-3 animate-skeleton-pulse" />
    <div className="w-1/2 h-3 bg-border rounded-sm mb-4 animate-skeleton-pulse" />
    <div className="mt-auto w-2/5 h-3 bg-border rounded-sm animate-skeleton-pulse" />
  </div>
);

export default SkeletonCard;
