import { describe, expect, it } from 'vitest'
import {
  compactText,
  normalizePersonName,
  normalizeSentenceText,
} from './textNormalizers'

describe('compactText', () => {
  it('removes leading and trailing spaces and compacts internal spaces', () => {
    expect(compactText('  tenemos   que usar anestesia local  ')).toBe(
      'tenemos que usar anestesia local',
    )
  })
})

describe('normalizeSentenceText', () => {
  it('capitalizes simple text as a sentence', () => {
    expect(normalizeSentenceText('dolor de muela')).toBe('Dolor de muela')
  })

  it('normalizes uppercase text without title casing every word', () => {
    expect(normalizeSentenceText('CARIES')).toBe('Caries')
  })

  it('compacts extra internal spaces', () => {
    expect(normalizeSentenceText('tenemos   que usar anestesia local')).toBe(
      'Tenemos que usar anestesia local',
    )
  })

  it('keeps accents and ñ', () => {
    expect(normalizeSentenceText('  inflamación en encía  ')).toBe(
      'Inflamación en encía',
    )
  })

  it('returns an empty string when text is empty', () => {
    expect(normalizeSentenceText('   ')).toBe('')
  })
})

describe('normalizePersonName', () => {
  it('capitalizes every given name and surname', () => {
    expect(normalizePersonName('Fabricio pérez suarez')).toBe(
      'Fabricio Pérez Suarez',
    )
  })

  it('keeps common Spanish name particles lowercase', () => {
    expect(normalizePersonName('  MARÍA   DEL CARMEN DE LA CRUZ  ')).toBe(
      'María del Carmen de la Cruz',
    )
  })

  it('supports compound names', () => {
    expect(normalizePersonName("juan-pablo d'angelo")).toBe(
      "Juan-Pablo D'Angelo",
    )
  })
})
