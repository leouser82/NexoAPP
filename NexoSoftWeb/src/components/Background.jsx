import { useMemo } from 'react'

export default function Background() {
  const bubbles = useMemo(
    () =>
      Array.from({ length: 22 }, (_, i) => {
        const size = 10 + ((i * 17) % 46)
        return {
          id: i,
          size,
          left: `${(i * 37) % 100}%`,
          duration: `${16 + (i % 20)}s`,
          delay: `${-((i * 11) % 22)}s`,
        }
      }),
    [],
  )

  return (
    <>
      <div className="noise" aria-hidden="true" />
      <div className="bubbles" aria-hidden="true">
        {bubbles.map((bubble) => (
          <span
            key={bubble.id}
            style={{
              width: bubble.size,
              height: bubble.size,
              left: bubble.left,
              animationDuration: bubble.duration,
              animationDelay: bubble.delay,
            }}
          />
        ))}
      </div>
      <div className="orb orb-a" aria-hidden="true" />
      <div className="orb orb-b" aria-hidden="true" />
    </>
  )
}
