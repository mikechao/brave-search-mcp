'use client';
import { IconArrowNarrowRight } from '@tabler/icons-react';
import { useEffect, useId, useRef, useState } from 'react';

export interface ImageSlideData {
  title: string;
  src: string;
  source: string;
  pageUrl: string;
}

interface SlideProps {
  slide: ImageSlideData;
  index: number;
  current: number;
  handleSlideClick: (index: number) => void;
  onOpenLink?: (slide: ImageSlideData) => void;
}

function Slide({ slide, index, current, handleSlideClick, onOpenLink }: SlideProps) {
  const slideRef = useRef<HTMLLIElement>(null);

  const xRef = useRef(0);
  const yRef = useRef(0);
  const frameRef = useRef<number>(0);

  useEffect(() => {
    const animate = () => {
      if (!slideRef.current)
        return;

      const x = xRef.current;
      const y = yRef.current;

      slideRef.current.style.setProperty('--x', `${x}px`);
      slideRef.current.style.setProperty('--y', `${y}px`);

      frameRef.current = requestAnimationFrame(animate);
    };

    frameRef.current = requestAnimationFrame(animate);

    return () => {
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current);
      }
    };
  }, []);

  const handleMouseMove = (event: React.MouseEvent) => {
    const el = slideRef.current;
    if (!el)
      return;

    const r = el.getBoundingClientRect();
    xRef.current = event.clientX - (r.left + Math.floor(r.width / 2));
    yRef.current = event.clientY - (r.top + Math.floor(r.height / 2));
  };

  const handleMouseLeave = () => {
    xRef.current = 0;
    yRef.current = 0;
  };

  const imageLoaded = (event: React.SyntheticEvent<HTMLImageElement>) => {
    event.currentTarget.style.opacity = '1';
  };

  const handleClick = () => {
    if (current !== index) {
      handleSlideClick(index);
    }
    else if (onOpenLink) {
      onOpenLink(slide);
    }
  };

  const { src, title } = slide;

  return (
    <div className="[perspective:1200px] [transform-style:preserve-3d]">
      <li
        ref={slideRef}
        className={`flex flex-1 flex-col items-center justify-center relative text-center text-white opacity-100 transition-all duration-300 ease-in-out w-[55vmin] h-[55vmin] mx-[2vmin] cursor-pointer ${current === index ? 'z-20' : 'z-10'
        }`}
        onClick={() => handleSlideClick(index)}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        style={{
          transform:
            current !== index
              ? 'scale(0.98) rotateX(8deg)'
              : 'scale(1) rotateX(0deg)',
          transition: 'transform 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
          transformOrigin: 'bottom',
        }}
      >
        <div
          className="absolute top-0 left-0 w-full h-full bg-[#1D1F2F] rounded-lg overflow-hidden transition-all duration-150 ease-out"
          onClick={(e) => {
            // Ensure click isn't swallowed
            e.stopPropagation();
            handleClick();
          }}
          style={{
            transform:
              current === index
                ? 'translate3d(calc(var(--x) / 30), calc(var(--y) / 30), 0)'
                : 'none',
          }}
        >
          <img
            className="absolute inset-0 w-[120%] h-[120%] object-cover transition-opacity duration-600 ease-in-out"
            style={{
              opacity: current === index ? 1 : 0.5,
            }}
            alt={title}
            src={src}
            onLoad={imageLoaded}
            loading="eager"
            decoding="sync"
          />
        </div>
      </li>
    </div>
  );
}

interface CarouselControlProps {
  type: string;
  title: string;
  handleClick: () => void;
}

function CarouselControl({
  type,
  title,
  handleClick,
}: CarouselControlProps) {
  return (
    <button
      className={`w-10 h-10 flex items-center justify-center bg-neutral-200 dark:bg-neutral-800 border-3 border-transparent rounded-full focus:border-[#6D64F7] focus:outline-none hover:-translate-y-0.5 active:translate-y-0.5 transition duration-200 cursor-pointer ${type === 'previous' ? 'rotate-180' : ''
      }`}
      title={title}
      onClick={handleClick}
    >
      <IconArrowNarrowRight className="text-neutral-600 dark:text-neutral-200" />
    </button>
  );
}

interface CarouselProps {
  slides: ImageSlideData[];
  onOpenLink?: (slide: ImageSlideData) => void;
}

export default function Carousel({ slides, onOpenLink }: CarouselProps) {
  const [current, setCurrent] = useState(0);
  const currentSlide = slides[current];

  const handlePreviousClick = () => {
    const previous = current - 1;
    setCurrent(previous < 0 ? slides.length - 1 : previous);
  };

  const handleNextClick = () => {
    const next = current + 1;
    setCurrent(next === slides.length ? 0 : next);
  };

  const handleSlideClick = (index: number) => {
    if (current !== index) {
      setCurrent(index);
    }
  };

  const handleViewClick = () => {
    if (onOpenLink && currentSlide) {
      onOpenLink(currentSlide);
    }
  };

  const id = useId();

  if (!currentSlide)
    return null;

  return (
    <div
      className="flex flex-col items-center gap-3"
      aria-labelledby={`carousel-heading-${id}`}
    >
      {/* Title above image */}
      <h2
        id={`carousel-heading-${id}`}
        className="text-lg font-semibold text-gray-900 text-center px-4 line-clamp-2"
      >
        {currentSlide.title}
      </h2>

      {/* Carousel images */}
      <div className="relative w-[55vmin] h-[55vmin]">
        <ul
          className="absolute flex mx-[-2vmin] transition-transform duration-1000 ease-in-out"
          style={{
            transform: `translateX(-${current * (100 / slides.length)}%)`,
          }}
        >
          {slides.map((slide, index) => (
            <Slide
              key={index}
              slide={slide}
              index={index}
              current={current}
              handleSlideClick={handleSlideClick}
              onOpenLink={onOpenLink}
            />
          ))}
        </ul>
      </div>

      {/* Controls: arrows + view button */}
      <div className="flex items-center justify-center gap-3">
        <CarouselControl
          type="previous"
          title="Go to previous slide"
          handleClick={handlePreviousClick}
        />

        <button
          onClick={handleViewClick}
          className="h-10 px-4 flex items-center justify-center bg-neutral-200 border-3 border-transparent rounded-full focus:border-[#6D64F7] focus:outline-none hover:-translate-y-0.5 active:translate-y-0.5 transition duration-200 text-sm font-medium text-neutral-600 cursor-pointer"
        >
          View ↗
        </button>

        <CarouselControl
          type="next"
          title="Go to next slide"
          handleClick={handleNextClick}
        />
      </div>
    </div>
  );
}
