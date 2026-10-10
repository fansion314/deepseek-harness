/** Desktop workspace zoom control and its shell-owned save notification. */
import { useState } from 'react'
import { Button, IconChevronDownOutlineRegular, Menu, IconLoadingOutlineRegular, Toast } from '@deepseek-ai/dsh-client-ui-primitives'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { DesktopScaleSource } from './desktop-scale-source.ts'
import css from './DesktopScaleRow.module.css'

/** Desktop preference source and operations bound by the slot registry. */
export interface DesktopScaleInjected {
  hooks: { scale: DesktopScaleSource['store'] }
  setScale(factor: number): void
  retry(): void
  dismiss(id: number): void
}

type Props = PropsLocale<'settings'> & InjectFace<DesktopScaleInjected>

/**
 * Render the desktop workspace scale selector.
 * @param props - Accepted device preference and localized controls.
 * @returns The General Settings row.
 */
export function DesktopScaleRow({ useScale, setScale, retry, t }: Props & PropsRuntime<'settings.general.item'>) {
  const view = useScale(value => value)
  const [open, setOpen] = useState(false)
  return <div className={css.row}>
    <div className={css.text}>
      <div className={css.title}>{t('desktop.scale.title')}</div>
      <div className={css.description}>{t('desktop.scale.description')}</div>
    </div>
    {view.loading ? <IconLoadingOutlineRegular className={css.loading} /> : view.failed || view.state === undefined
      ? <Button variant="outline" size="sm" onClick={retry}>{t('desktop.scale.retry')}</Button>
      : <Menu open={open} onClose={() => { setOpen(false) }} portal align="end"
        selectedId={String(view.state.factor)}
        items={view.state.options.map(factor => ({ id: String(factor), label: `${Math.round(factor * 100)}%` }))}
        onSelect={(id) => { setOpen(false); setScale(Number(id)) }}
        anchor={<button type="button" className={css.selector} disabled={view.saving}
          aria-label={t('desktop.scale.title')} aria-haspopup="menu" aria-expanded={open}
          onClick={() => { setOpen(value => !value) }}>
          {Math.round(view.state.factor * 100)}%<IconChevronDownOutlineRegular />
        </button>} />}
  </div>
}

/**
 * Report saves outside the settings modal lifetime.
 * @param props - Shared save outcome and active locale.
 * @returns A notification that survives closing Settings.
 */
export function DesktopScaleNotice({ useScale, dismiss, t }: Props & PropsRuntime<'shell.overlay'>) {
  const view = useScale(value => value)
  const notice = view.notice
  if (notice === undefined) return null
  return <Toast key={notice.id} {...notice.saved ? { tone: 'success' as const } : {}}
    text={notice.saved ? t('desktop.scale.saved') : t('desktop.scale.error')}
    onDone={() => { dismiss(notice.id) }} />
}
