import { useId } from 'react'

import type { TicketPriority, TicketStatus } from '../api/tickets'
import { PRIORITY_LABELS, STATUS_LABELS } from './labels'
import { ASSIGNEE_MAX_LENGTH, TITLE_MAX_LENGTH } from './ticketForm'
import type { TicketFormErrors, TicketFormValues } from './ticketForm'
import './TicketFormFields.css'

export type TicketField = keyof TicketFormValues | 'status'

interface TicketFormFieldsProps {
  /** Avec un statut, le champ Statut est affiché (modification). */
  values: TicketFormValues & { status?: TicketStatus }
  errors: TicketFormErrors
  onChange: (field: TicketField, value: string) => void
}

const PRIORITIES: TicketPriority[] = ['low', 'medium', 'high']
const STATUSES: TicketStatus[] = ['todo', 'in_progress', 'done']

/** Champs communs aux formulaires de création et de modification d'un ticket. */
export function TicketFormFields({ values, errors, onChange }: TicketFormFieldsProps) {
  const id = useId()

  return (
    <>
      <div className="field">
        <label htmlFor={`${id}-title`}>
          Titre <span aria-hidden="true">*</span>
        </label>
        <input
          id={`${id}-title`}
          value={values.title}
          onChange={(event) => onChange('title', event.target.value)}
          maxLength={TITLE_MAX_LENGTH}
          required
          aria-invalid={errors.title ? true : undefined}
          aria-describedby={errors.title ? `${id}-title-error` : undefined}
          autoFocus
        />
        {errors.title && (
          <p id={`${id}-title-error`} className="field-error">
            {errors.title}
          </p>
        )}
      </div>

      <div className="field">
        <label htmlFor={`${id}-description`}>Description</label>
        <textarea
          id={`${id}-description`}
          value={values.description}
          onChange={(event) => onChange('description', event.target.value)}
          rows={3}
        />
      </div>

      <div className="field-row">
        {values.status !== undefined && (
          <div className="field">
            <label htmlFor={`${id}-status`}>Statut</label>
            <select
              id={`${id}-status`}
              value={values.status}
              onChange={(event) => onChange('status', event.target.value)}
            >
              {STATUSES.map((status) => (
                <option key={status} value={status}>
                  {STATUS_LABELS[status]}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="field">
          <label htmlFor={`${id}-priority`}>Priorité</label>
          <select
            id={`${id}-priority`}
            value={values.priority}
            onChange={(event) => onChange('priority', event.target.value)}
          >
            {PRIORITIES.map((priority) => (
              <option key={priority} value={priority}>
                {PRIORITY_LABELS[priority]}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor={`${id}-assignee`}>Assigné</label>
          <input
            id={`${id}-assignee`}
            value={values.assignee}
            onChange={(event) => onChange('assignee', event.target.value)}
            maxLength={ASSIGNEE_MAX_LENGTH}
            aria-invalid={errors.assignee ? true : undefined}
            aria-describedby={errors.assignee ? `${id}-assignee-error` : undefined}
          />
          {errors.assignee && (
            <p id={`${id}-assignee-error`} className="field-error">
              {errors.assignee}
            </p>
          )}
        </div>
      </div>
    </>
  )
}
