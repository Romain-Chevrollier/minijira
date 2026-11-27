// Mêmes limites que l'API (backend/app/schemas.py)
export const PROJECT_NAME_MAX_LENGTH = 100
export const PROJECT_KEY_MAX_LENGTH = 10

/** Retire les accents et met en majuscules : « Côté » donne « COTE ». */
function toPlainUppercase(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/Œ/g, 'OE')
    .replace(/Æ/g, 'AE')
}

/** Majuscules sans accent, en ne gardant que les lettres et les chiffres. */
function lettersAndDigits(text: string): string {
  return toPlainUppercase(text).replace(/[^A-Z0-9]/g, '')
}

/**
 * Nettoie la clé pendant la frappe : majuscules, sans accent, seulement des lettres
 * et des chiffres, 10 caractères au plus. « mai son » donne « MAISON ».
 */
export function cleanKeyInput(value: string): string {
  return lettersAndDigits(value).slice(0, PROJECT_KEY_MAX_LENGTH)
}

/**
 * Clé proposée d'après le nom : « Côté jardin » donne « COTEJARDIN ».
 * Les chiffres du début sont retirés avant de couper à 10 caractères, une clé
 * commençant par une lettre : « 2027 Vacances » donne « VACANCES ».
 */
export function suggestKey(name: string): string {
  return lettersAndDigits(name).replace(/^[0-9]+/, '').slice(0, PROJECT_KEY_MAX_LENGTH)
}

/** Erreur du nom, ou undefined s'il est valide. */
export function validateProjectName(name: string): string | undefined {
  const trimmed = name.trim()
  if (trimmed === '') return 'Le nom est obligatoire.'
  if (trimmed.length > PROJECT_NAME_MAX_LENGTH) {
    return `Le nom ne doit pas dépasser ${PROJECT_NAME_MAX_LENGTH} caractères.`
  }
  return undefined
}

/** Message affiché quand une clé appartient déjà à un autre projet. */
export function keyTakenMessage(key: string): string {
  return `La clé ${key} est déjà utilisée par un autre projet.`
}

/**
 * Erreur de la clé, ou undefined si elle est valide et libre.
 * Mêmes règles que l'API : 2 à 10 caractères, une lettre d'abord, puis lettres ou chiffres.
 */
export function validateProjectKey(
  key: string,
  existingKeys: readonly string[],
): string | undefined {
  if (key === '') return 'La clé est obligatoire.'
  if (key.length < 2) return 'La clé doit faire au moins 2 caractères.'
  if (!/^[A-Z]/.test(key)) return 'La clé doit commencer par une lettre.'
  if (!/^[A-Z][A-Z0-9]{1,9}$/.test(key)) {
    return 'La clé ne peut contenir que des lettres majuscules sans accent et des chiffres.'
  }
  if (existingKeys.includes(key)) return keyTakenMessage(key)
  return undefined
}
