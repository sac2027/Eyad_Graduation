import { registerMessages } from '@/i18n'
import { ar } from './ar'
import { en } from './en'

// Importing this file is what makes the stadium's strings available. The stadium page imports it
// first, so they are in place before anything is drawn.
registerMessages({ ar, en })
