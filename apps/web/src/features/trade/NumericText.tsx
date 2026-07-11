const NUMBER_PATTERN = /(\d[\d,]*(?:\.\d+)?)/g
const NUMBER_PART_PATTERN = /^\d[\d,]*(?:\.\d+)?$/

export function NumericText({ value }: { value: string }) {
  return (
    <>
      {value.split(NUMBER_PATTERN).map((part, index) => (
        NUMBER_PART_PATTERN.test(part)
          ? <span className="token-swap-widget__number" key={`${part}:${index}`}>{part}</span>
          : part
      ))}
    </>
  )
}
