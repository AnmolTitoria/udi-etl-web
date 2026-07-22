const DEFAULT_STEPS = ['Connector', 'Schema', 'Target', 'Run']

interface StepperProps {
  currentStep: number
  steps?: string[]
}

function CheckIcon() {
  return (
    <svg className="stepper-check" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M4 10.5L8 14.5L16 5.5"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export default function Stepper({ currentStep, steps = DEFAULT_STEPS }: StepperProps) {
  return (
    <ol className="stepper">
      {steps.map((label, index) => {
        const status = index === currentStep ? 'active' : index < currentStep ? 'done' : 'upcoming'
        return (
          <li className={`stepper-item stepper-item--${status}`} key={label}>
            <span className="stepper-index">{status === 'done' ? <CheckIcon /> : index + 1}</span>
            <span className="stepper-label">{label}</span>
          </li>
        )
      })}
    </ol>
  )
}
