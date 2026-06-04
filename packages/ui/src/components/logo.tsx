import { ComponentProps } from "solid-js"

const Paths = () => {
  return (
    <g transform="translate(2 13)" fill="var(--icon-strong-base)">
      <path d="M15.65,16.07L11.1,0H0s8.03,29.6,8.03,29.6c4.48,0,9-.03,14,0l3-9.97c-4-3.13-8.92-3.48-9.38-3.56h0Z" />
      <path d="M27.23,12.97L31.73.96l-10.63.04-4.73,12.44c3.98-.59,7.6-.79,10.86-.47Z" />
      <path d="M50.31.96h-15.68s-2.8,7.63-2.8,7.63l7.15-.03c.68,0,1.16.67.93,1.31-.46,1.32-1.2,3.38-1.82,5.09,3.24,1.14,6.17,2.81,8.31,4.57,1.06-1.96,4.3-10.77,6.04-15.54.54-1.47-.55-3.03-2.12-3.02Z" />
      <path d="M45.54,21.96c-2.1-1.81-4.83-3.53-8.12-4.94-3.02-1.29-6.53-2.32-10.6-2.67-5.78-.5-10.74.47-10.74.47.52.06,0,0,0,0,6.4.23,17.79,4.4,20.93,14.84h15.01s-1.88-3.75-6.47-7.7Z" />
    </g>
  )
}

export const Mark = (props: { class?: string }) => {
  return (
    <svg
      data-component="logo-mark"
      classList={{ [props.class ?? ""]: !!props.class }}
      viewBox="0 0 56 56"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <Paths />
    </svg>
  )
}

export const Splash = (props: Pick<ComponentProps<"svg">, "ref" | "class">) => {
  return (
    <svg
      ref={props.ref}
      data-component="logo-splash"
      classList={{ [props.class ?? ""]: !!props.class }}
      viewBox="0 0 56 56"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <Paths />
    </svg>
  )
}

export const Logo = (props: { class?: string }) => {
  return (
    <img
      data-component="logo-full"
      src="/railwise-logo.svg"
      alt="RAILWISE"
      classList={{ [props.class ?? ""]: !!props.class }}
    />
  )
}
