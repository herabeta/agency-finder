'use client';

import { useEffect } from 'react';

const PAGE_SIZE = 50;

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
        button.style.cssText = `border:1px solid #dfe4e8;border-radius:8px;background:${page === currentPage ? '#17202a' : '#fff'};color:${page === currentPage ? '#fff' : '#17202a'};padding:7px 11px;font-size:11px;font-weight:700;cursor:${disabled ? 'default' : 'pointer'};opacity:${disabled ? '.45' : '1'};`;
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
