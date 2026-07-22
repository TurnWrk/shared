import * as Invite from './invite.js';
import * as PasswordReset from './password-reset.js';
import * as MagicLink from './magic-link.js';
import * as Estimate from './estimate.js';
import * as CleanNotification from './clean-notification.js';
import type { Templates } from '../types.js';
import type * as React from 'react';

type TemplateModule<T> = {
  default: (data: T) => React.ReactElement;
  subject: (data: T) => string;
};

export const templates: { [K in keyof Templates]: TemplateModule<Templates[K]> } = {
  invite: Invite as TemplateModule<Templates['invite']>,
  'password-reset': PasswordReset as TemplateModule<Templates['password-reset']>,
  'magic-link': MagicLink as TemplateModule<Templates['magic-link']>,
  estimate: Estimate as TemplateModule<Templates['estimate']>,
  'clean-notification': CleanNotification as TemplateModule<Templates['clean-notification']>,
};
