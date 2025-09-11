// frontend/src/hooks/useInfiniteScroll.js
import { useState, useEffect, useCallback, useRef } from "react";

const useInfiniteScroll = (fetchMore, hasMore = true) => {
  const [isFetching, setIsFetching] = useState(false);
  const observerRef = useRef();
  const sentinelRef = useRef();

  // Intersection Observer callback
  const handleObserver = useCallback(
    (entries) => {
      const target = entries[0];
      if (target.isIntersecting && hasMore && !isFetching) {
        setIsFetching(true);
      }
    },
    [hasMore, isFetching]
  );

  // Set up Intersection Observer
  useEffect(() => {
    const observer = new IntersectionObserver(handleObserver, {
      threshold: 0.1,
      rootMargin: "50px",
    });

    if (sentinelRef.current) {
      observer.observe(sentinelRef.current);
    }

    observerRef.current = observer;

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [handleObserver]);

  // Fetch more data when isFetching is true
  useEffect(() => {
    if (!isFetching) return;

    const fetchData = async () => {
      try {
        await fetchMore();
      } catch (error) {
        console.error("Error fetching more data:", error);
      } finally {
        setIsFetching(false);
      }
    };

    fetchData();
  }, [isFetching, fetchMore]);

  return {
    isFetching,
    sentinelRef,
    setIsFetching,
  };
};

export default useInfiniteScroll;
