'use client';

import { useEffect } from 'react';

const PAGE_SIZE = 50;

function addContactTools(card: HTMLElement) {
  if (card.querySelector('[data-contact-tools]')) return;
  const phoneText = Array.from(card.querySelectorAll('span')).map((el) => el.textContent || '').find((text) => /\+?\d[\d\s().-]{7,}/.test(text));
  const phone = phoneText?.match(/\+?\d[\d\s().-]{7,}/)?.[0]?.replace(/[^\d+]/g, '') || '';
  const actionRow = Array.from(card.querySelectorAll('div')).find((el) => {
    const text = el.textContent || '';
    return text.includes('Save') && text.includes('Follow-up');
  }) as HTMLElement | undefined;
  if (!actionRow) return;

  const tools = document.createElement('div');
  tools.setAttribute('data-contact-tools', 'true');
  tools.style.cssText = 'display:flex;gap:6px;flex-wrap:wrap;margin-top:8px;padding-top:8px;border-top:1px solid #edf0f2;';

  const make = (label: string, href: string, primary = false) => {
    const a = document.createElement('a');
    a.textContent = label;
    a.href = href;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.style.cssText = `display:inline-flex;align-items:center;justify-content:center;padding:7px 10px;border-radius:7px;text-decoration:none;font-size:10px;font-weight:700;border:1px solid ${primary ? '#4f46e5' : '#dfe5f0'};background:${primary ? 'linear-gradient(135deg,#4f46e5,#2563eb)' : '#fff'};color:${primary ? '#fff' : '#475467'};`;
    return a;
  };

  if (phone) {
    tools.appendChild(make('☎ Call', `tel:${phone}`));
    const digits = phone.replace(/\D/g, '');
    if (digits) tools.appendChild(make('WhatsApp', `https://wa.me/${digits}`, true));
  }

  const status = Array.from(card.querySelectorAll('select')).find((el) => Array.from(el.options).some((o) => o.value === 'Contacted')) as HTMLSelectElement | undefined;
  if (status) {
    const contacted = document.createElement('button');
    contacted.type = 'button';
    contacted.textContent = status.value === 'Contacted' ? '✓ Contacted' : 'Mark contacted';
    contacted.style.cssText = 'display:inline-flex;align-items:center;justify-content:center;padding:7px 10px;border-radius:7px;border:1px solid #dfe5f0;background:#fff;color:#475467;font-size:10px;font-weight:700;cursor:pointer;';
    contacted.onclick = () => {
      status.value = 'Contacted';
      status.dispatchEvent(new Event('change', { bubbles: true }));
      contacted.textContent = '✓ Contacted';
    };
    tools.appendChild(contacted);
  }

  if (tools.children.length) actionRow.parentElement?.appendChild(tools);
}

export default function PaginationClient() {
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let currentPage = 1;
    let lastSignature = '';

    const setup = () => {
      const heading = Array.from(document.querySelectorAll('h2')).find((el) => el.textContent?.trim() === 'Priority opportunities');
      const header = heading?.parentElement?.parentElement;
      const grid = header?.nextElementSibling as HTMLElement | null;
      if (!grid || !heading) return;

      const cards = Array.from(grid.children).filter((el) => el.tagName === 'ARTICLE') as HTMLElement[];
      const signature = cards.map((card) => card.getAttribute('data-pagination-key') || card.textContent?.slice(0, 120) || '').join('|');
      const changed = signature !== lastSignature;
      if (changed) {
        currentPage = 1;
        lastSignature = signature;
      }

      const totalPages = Math.max(1, Math.ceil(cards.length / PAGE_SIZE));
      if (currentPage > totalPages) currentPage = totalPages;
      cards.forEach((card, index) => {
        card.style.display = index >= (currentPage - 1) * PAGE_SIZE && index < currentPage * PAGE_SIZE ? '' : 'none';
        if (card.style.display !== 'none') addContactTools(card);
      });

      let pager = document.getElementById('agency-finder-pagination');
      if (!pager) {
        pager = document.createElement('div');
        pager.id = 'agency-finder-pagination';
        pager.style.cssText = 'display:flex;justify-content:center;align-items:center;gap:6px;flex-wrap:wrap;margin:16px 0 28px;padding:10px 0;';
        grid.insertAdjacentElement('afterend', pager);
      }
      pager.innerHTML = '';
      if (cards.length <= PAGE_SIZE) {
        pager.style.display = 'none';
        return;
      }
      pager.style.display = 'flex';

      const makeButton = (label: string, page: number, disabled = false) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = label;
        button.disabled = disabled;
        button.style.cssText = `border:1px solid #dfe4e8;border-radius:8px;background:${page === currentPage ? '#4f46e5' : '#fff'};color:${page === currentPage ? '#fff' : '#17202a'};padding:7px 11px;font-size:11px;font-weight:700;cursor:${disabled ? 'default' : 'pointer'};opacity:${disabled ? '.45' : '1'};`;
        button.onclick = () => { currentPage = page; setup(); window.scrollTo({ top: heading.getBoundingClientRect().top + window.scrollY - 20, behavior: 'smooth' }); };
        pager?.appendChild(button);
      };

      makeButton('‹ Prev', currentPage - 1, currentPage === 1);
      const start = Math.max(1, currentPage - 2);
      const end = Math.min(totalPages, start + 4);
      for (let page = start; page <= end; page++) makeButton(String(page), page);
      makeButton('Next ›', currentPage + 1, currentPage === totalPages);

      const info = document.createElement('span');
      info.textContent = `Page ${currentPage} of ${totalPages} · ${cards.length} agencies`;
      info.style.cssText = 'font-size:11px;color:#7d8793;margin-left:5px;';
      pager.appendChild(info);
    };

    const schedule = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(setup, 30);
    };

    setup();
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      if (timer) clearTimeout(timer);
    };
  }, []);

  return null;
}
