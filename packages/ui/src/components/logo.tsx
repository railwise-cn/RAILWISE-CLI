import { ComponentProps } from "solid-js"

export const Mark = (props: { class?: string }) => {
  return (
    <svg
      data-component="logo-mark"
      classList={{ [props.class ?? ""]: !!props.class }}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M4 20V4H14C17.3 4 19.4 5.8 19.4 8.8C19.4 11 18.2 12.5 16.2 13.2L20 20H15.2L11.8 13.8H8.2V20H4Z"
        fill="var(--icon-strong-base)"
      />
      <path
        d="M8.2 10.4H13.4C14.6 10.4 15.2 9.8 15.2 8.9C15.2 7.9 14.6 7.4 13.4 7.4H8.2V10.4Z"
        fill="var(--icon-weak-base)"
      />
    </svg>
  )
}

export const Splash = (props: Pick<ComponentProps<"svg">, "ref" | "class">) => {
  return (
    <svg
      ref={props.ref}
      data-component="logo-splash"
      classList={{ [props.class ?? ""]: !!props.class }}
      viewBox="0 0 80 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M14 86V14H50C64 14 73 22 73 35C73 44 68 51 59 54L74 86H54L41 58H33V86H14Z"
        fill="var(--icon-strong-base)"
      />
      <path d="M33 43H48C53 43 56 40 56 35C56 30 53 27 48 27H33V43Z" fill="var(--icon-base)" />
    </svg>
  )
}

export const Logo = (props: { class?: string }) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 320 64"
      fill="none"
      classList={{ [props.class ?? ""]: !!props.class }}
    >
      <rect x="0" y="8" width="48" height="48" rx="6" fill="var(--icon-strong-base)" />
      <path
        d="M12 46V18H30C36 18 40 21.4 40 26.7C40 30.7 37.8 33.5 34.2 34.8L42 46H32.5L25.8 35.8H20.5V46H12Z"
        fill="var(--surface-base)"
      />
      <path
        d="M20.5 29.5H29.2C31.2 29.5 32.2 28.5 32.2 26.9C32.2 25.2 31.2 24.3 29.2 24.3H20.5V29.5Z"
        fill="var(--icon-weak-base)"
      />
      <text
        x="64"
        y="42"
        fill="var(--icon-strong-base)"
        font-family="Inter, Arial, sans-serif"
        font-size="30"
        font-weight="700"
        letter-spacing="0"
      >
        RAILWISE
      </text>
    </svg>
  )
}
