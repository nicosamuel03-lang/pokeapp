import { useState, useRef, useEffect, useCallback } from "react";
import { useTheme } from "../state/ThemeContext";

export interface NewsItem {
  id: string;
  title: string;
  category: string;
  subtext?: string;
  backgroundImage?: string;
  /** "exclu" = gold bg + black text; default = gold text on transparent */
  badgeVariant?: "default" | "exclu";
}

const NEWS_ITEMS: NewsItem[] = [
  {
    id: "exclu-me03",
    category: "EXCLU",
    title: "Équilibre Parfait : Méga-Staross débarque !",
    subtext: "Découvrez les premières cartes de la nouvelle extension.",
    backgroundImage: "/images/news/ME03.png",
    badgeVariant: "exclu",
  },
  {
    id: "me04-new",
    category: "NEW",
    title: "ME04 : Les nouvelles Display arrivent !",
    subtext: "Découvrez les visuels officiels de la prochaine extension.",
    backgroundImage: "/images/news/ME04.png",
    badgeVariant: "exclu",
  },
  {
    id: "1",
    title: "Zenith Supreme: Market supply decreasing, prices trending up",
    category: "MARKET",
  },
  {
    id: "2",
    title: "Rumor: Potential reprint for Scarlet & Violet base ETBs",
    category: "RUMOR",
  },
  {
    id: "3",
    title: "Upcoming: 'Héros Transcendants' pre-orders expected next week",
    category: "NEXT DROP",
  },
];

const HOLD_PLUS_TRANSITION_MS = 7000; // 5s read + 2s transition
const TRANSITION_DURATION_MS = 2000;

const TOTAL_SLOTS = NEWS_ITEMS.length + 1; // items + clone of first
const CARD_SLOT_WIDTH = 100 / TOTAL_SLOTS;
const CAROUSEL_HEIGHT = 180;

const getCardBase = (): React.CSSProperties => ({
  flex: `0 0 ${CARD_SLOT_WIDTH}%`,
  width: `${CARD_SLOT_WIDTH}%`,
  minWidth: 0,
  flexShrink: 0,
  padding: "14px 16px",
  height: "100%",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: 6,
  boxSizing: "border-box",
  textAlign: "center",
  margin: 0,
  outline: "none",
  background: "var(--card-color)",
});

function NewsCard({ item }: { item: NewsItem }) {
  const { theme } = useTheme();
  const accentGold = theme === "dark" ? "#FBBF24" : "#D4A757";
  const isImageCard = Boolean(item.backgroundImage);
  const CARD_BASE = getCardBase();

  if (isImageCard) {
    const badgeBg = item.category === "NEW" ? "#10b981" : item.category === "PRE-ORDER" ? "#8b5cf6" : accentGold;
    return (
      <div
        style={{
          ...CARD_BASE,
          position: "relative",
          width: "100%",
          height: "100%",
          backgroundImage: `linear-gradient(transparent, rgba(0,0,0,0.8)), url(${item.backgroundImage})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
        }}
      >
        <span
          style={{
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            backgroundColor: badgeBg,
            color: "#000",
            padding: "3px 8px",
            borderRadius: 4,
          }}
        >
          {item.category}
        </span>
        <p
          style={{
            margin: 0,
            fontSize: 13,
            lineHeight: 1.35,
            color: "#FFFFFF",
            fontWeight: 600,
          }}
        >
          {item.title}
        </p>
        {item.subtext && (
          <p
            style={{
              margin: 0,
              fontSize: 11,
              lineHeight: 1.3,
              color: "rgba(255,255,255,0.9)",
              fontWeight: 400,
            }}
          >
            {item.subtext}
          </p>
        )}
      </div>
    );
  }

  const badgeStyle =
    item.badgeVariant === "exclu"
      ? { backgroundColor: accentGold, color: "#000", padding: "2px 6px", borderRadius: 4 }
      : { color: accentGold };

  return (
    <div style={CARD_BASE as React.CSSProperties}>
      <span
        style={{
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          ...badgeStyle,
        }}
      >
        {item.category}
      </span>
      <p
        style={{
          margin: 0,
          fontSize: 13,
          lineHeight: 1.35,
          color: "var(--text-primary)",
          fontWeight: 500,
        }}
      >
        {item.title}
      </p>
    </div>
  );
}

const itemsWithClone = [...NEWS_ITEMS, NEWS_ITEMS[0]];

export function NewsCarousel() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [transitionEnabled, setTransitionEnabled] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const currentIndexRef = useRef(currentIndex);
  currentIndexRef.current = currentIndex;

  const advance = useCallback(() => {
    if (currentIndexRef.current >= itemsWithClone.length - 1) {
      setTransitionEnabled(false);
      setCurrentIndex(0);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setTransitionEnabled(true));
      });
    } else {
      setCurrentIndex((i) => i + 1);
    }
  }, []);

  const startInterval = useCallback(() => {
    intervalRef.current = setInterval(advance, HOLD_PLUS_TRANSITION_MS);
  }, [advance]);

  const stopInterval = useCallback(() => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    startInterval();
    return stopInterval;
  }, [startInterval, stopInterval]);

  const handleMouseEnter = useCallback(() => {
    stopInterval();
  }, [stopInterval]);

  const handleMouseLeave = useCallback(() => {
    startInterval();
  }, [startInterval]);

  const translateX = -(currentIndex * CARD_SLOT_WIDTH);
  const trackStyle: React.CSSProperties = {
    display: "flex",
    flexDirection: "row",
    width: `${TOTAL_SLOTS * 100}%`,
    height: "100%",
    margin: 0,
    padding: 0,
    transform: `translateX(${translateX}%)`,
    transition: transitionEnabled
      ? `transform ${TRANSITION_DURATION_MS}ms ease-in-out`
      : "none",
    flexShrink: 0,
    outline: "none",
  };

  return (
    <div
      className="news-carousel"
      role="region"
      aria-label="Actualités marché"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={{
        width: "100%",
        height: CAROUSEL_HEIGHT,
        maxHeight: CAROUSEL_HEIGHT,
        overflow: "hidden",
        borderRadius: 0,
        background: "transparent",
        boxShadow: "0 2px 12px rgba(0,0,0,0.12)",
        border: "none",
        outline: "none",
        cursor: "default",
        userSelect: "none",
        isolation: "isolate",
        zIndex: 1,
        position: "relative",
        padding: 0,
        margin: 0,
        paddingBottom: 0,
      }}
    >
      <div
        style={{
          overflow: "hidden",
          height: "100%",
          width: "100%",
          borderRadius: 0,
          padding: 0,
          margin: 0,
        }}
      >
        <div style={trackStyle}>
          {itemsWithClone.map((item, i) => (
            <NewsCard key={`${item.id}-${i}`} item={item} />
          ))}
        </div>
      </div>
      <div
        style={{
          position: "absolute",
          bottom: 6,
          left: 0,
          right: 0,
          display: "flex",
          justifyContent: "center",
          gap: 4,
          padding: 0,
          margin: 0,
          pointerEvents: "none",
        }}
      >
        {NEWS_ITEMS.map((_, i) => {
          const activeIndex = currentIndex % NEWS_ITEMS.length;
          return (
            <span
              key={i}
              style={{
                width: 3,
                height: 3,
                borderRadius: "50%",
                background:
                  i === activeIndex
                    ? "rgba(212, 167, 87, 0.95)"
                    : "rgba(212, 167, 87, 0.3)",
              }}
              aria-hidden
            />
          );
        })}
      </div>
    </div>
  );
}
