// Props that suppress browser address/contact autofill + suggestion dropdowns
// in both Chrome and Safari. Chrome ignores autoComplete="off" for address
// fields, so we use a non-standard token plus the data-* hints that Chrome and
// common password managers (LastPass, 1Password) respect.
export const NO_AUTOFILL = {
  autoComplete: 'new-password',
  autoCorrect: 'off',
  autoCapitalize: 'off',
  spellCheck: false,
  'data-lpignore': 'true',
  'data-form-type': 'other',
  'data-1p-ignore': 'true',
}
