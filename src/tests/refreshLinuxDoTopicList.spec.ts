import { describe, expect, it, vi } from 'vitest'

import { refreshLinuxDoTopicListInPlace } from '../sites/linuxDo'

function createDocument(html: string): Document {
  const doc = document.implementation.createHTMLDocument('')

  doc.body.innerHTML = html

  return doc
}

describe('refreshLinuxDoTopicListInPlace', () => {
  it('clicks the show-more banner when present', () => {
    const doc = createDocument(`
      <div class="show-more has-topics">
        <a class="alert alert-info clickable" href="/latest">3 new topics</a>
      </div>
      <ul class="nav-pills">
        <li class="active"><a href="/latest">Latest</a></li>
      </ul>
    `)
    const banner = doc.querySelector<HTMLAnchorElement>('.show-more.has-topics a.alert.alert-info.clickable')

    if (!banner)
      throw new Error('Expected banner fixture')

    const clickSpy = vi.spyOn(banner, 'click')

    expect(refreshLinuxDoTopicListInPlace(doc)).toBe(true)
    expect(clickSpy).toHaveBeenCalledOnce()
  })

  it('clicks the active nav pill when no banner is present', () => {
    const doc = createDocument(`
      <div class="navigation-container">
        <ul class="nav-pills">
          <li class="active"><a href="/latest">Latest</a></li>
          <li><a href="/top">Top</a></li>
        </ul>
      </div>
    `)
    const pill = doc.querySelector<HTMLAnchorElement>('.nav-pills li.active > a[href]')

    if (!pill)
      throw new Error('Expected active nav pill fixture')

    const clickSpy = vi.spyOn(pill, 'click')

    expect(refreshLinuxDoTopicListInPlace(doc)).toBe(true)
    expect(clickSpy).toHaveBeenCalledOnce()
  })

  it('returns false when no in-place refresh affordance is present', () => {
    const doc = createDocument(`
      <main>
        <p>No refresh affordances here.</p>
      </main>
    `)
    const clickSpy = vi.spyOn(HTMLElement.prototype, 'click')

    try {
      expect(refreshLinuxDoTopicListInPlace(doc)).toBe(false)
      expect(clickSpy).not.toHaveBeenCalled()
    }
    finally {
      clickSpy.mockRestore()
    }
  })

  it('returns false when the document is null or undefined', () => {
    expect(refreshLinuxDoTopicListInPlace(null)).toBe(false)
    expect(refreshLinuxDoTopicListInPlace(undefined)).toBe(false)
  })
})
