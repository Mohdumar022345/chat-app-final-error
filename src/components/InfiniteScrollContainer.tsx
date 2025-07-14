import { useInView } from "react-intersection-observer"

interface InfiniteScrollContainerProps extends React.PropsWithChildren {
    onTopReached: () => void,
    className?: string
}

export default function InfiniteScrollContainer({ children, onTopReached, className }: InfiniteScrollContainerProps) {
    const { ref } = useInView({
        rootMargin: "200px",
        onChange(inView) {
          if (inView) {
            onTopReached();
          }
        },
      });
    
      return (
        <div className={className}>
          {children}
          <div ref={ref} />
        </div>
      );
}