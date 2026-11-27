import { describe, expect, it } from 'vitest'

import {
  cleanKeyInput,
  suggestKey,
  validateProjectKey,
  validateProjectName,
} from './projectForm'

describe('suggestKey', () => {
  it.each([
    ['Maison', 'MAISON'],
    ['Côté jardin', 'COTEJARDIN'],
    ['  été  ', 'ETE'],
    ["L'Œuvre", 'LOEUVRE'],
    ['Projet très très long', 'PROJETTRES'],
    ['2027 Vacances', 'VACANCES'],
    ['V2', 'V2'],
    ['!!!', ''],
    ['', ''],
  ])('« %s » donne « %s »', (name, key) => {
    expect(suggestKey(name)).toBe(key)
  })
})

describe('cleanKeyInput', () => {
  it.each([
    ['maison', 'MAISON'],
    ['mai son', 'MAISON'],
    ['été', 'ETE'],
    ['AB-12', 'AB12'],
    // Un chiffre au début est gardé : la validation l'explique
    ['1abc', '1ABC'],
    ['abcdefghijkl', 'ABCDEFGHIJ'],
  ])('« %s » devient « %s »', (typed, key) => {
    expect(cleanKeyInput(typed)).toBe(key)
  })
})

describe('validateProjectName', () => {
  it('accepte un nom de 1 à 100 caractères', () => {
    expect(validateProjectName('M')).toBeUndefined()
    expect(validateProjectName('x'.repeat(100))).toBeUndefined()
  })

  it.each(['', '   '])('refuse un nom vide (%j)', (name) => {
    expect(validateProjectName(name)).toBe('Le nom est obligatoire.')
  })

  it('refuse un nom de plus de 100 caractères', () => {
    expect(validateProjectName('x'.repeat(101))).toBe(
      'Le nom ne doit pas dépasser 100 caractères.',
    )
  })
})

describe('validateProjectKey', () => {
  it.each(['AB', 'V2', 'ABCDEFGHIJ'])('accepte « %s »', (key) => {
    expect(validateProjectKey(key, ['PERSO'])).toBeUndefined()
  })

  it.each([
    ['', 'La clé est obligatoire.'],
    ['A', 'La clé doit faire au moins 2 caractères.'],
    ['1AB', 'La clé doit commencer par une lettre.'],
    ['PERSO', 'La clé PERSO est déjà utilisée par un autre projet.'],
  ])('refuse « %s »', (key, message) => {
    expect(validateProjectKey(key, ['PERSO'])).toBe(message)
  })
})
