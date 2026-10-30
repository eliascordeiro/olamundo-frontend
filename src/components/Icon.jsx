export default function Icon({ name, size = 20, ...props }) {
  const paths = {
    arrow: <path d="M5 12h14m-6-6 6 6-6 6" />,
    lock: <><rect x="5" y="10" width="14" height="11" rx="3" /><path d="M8 10V7a4 4 0 0 1 8 0v3m-4 5v2" /></>,
    mail: <><rect x="3" y="5" width="18" height="14" rx="3" /><path d="m3 7 9 6 9-6" /></>,
    user: <><circle cx="12" cy="8" r="4" /><path d="M4 21v-2a8 8 0 0 1 16 0v2" /></>,
    eye: <><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></>,
    hide: <><path d="m3 3 18 18M10 5a11 11 0 0 1 12 7 18 18 0 0 1-3 4M6 6a18 18 0 0 0-4 6s4 7 10 7a12 12 0 0 0 5-1" /><path d="M10 10a3 3 0 0 0 4 4" /></>,
    shield: <><path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3Z" /><path d="m8 12 3 3 5-6" /></>,
    chart: <><path d="M4 4v16h17M8 15l4-5 4 2 5-7" /></>,
    menu: <path d="M4 6h16M4 12h16M4 18h16" />,
    grid: <><rect x="3" y="3" width="7" height="7" rx="2" /><rect x="14" y="3" width="7" height="7" rx="2" /><rect x="3" y="14" width="7" height="7" rx="2" /><rect x="14" y="14" width="7" height="7" rx="2" /></>,
    home: <><path d="m3 10 9-7 9 7" /><path d="M5 9v11h14V9M9 20v-6h6v6" /></>,
    products: <><path d="m12 3 9 5-9 5-9-5 9-5Z" /><path d="m3 8 9 5 9-5M3 8v9l9 5 9-5V8M12 13v9" /></>,
    inventory: <><path d="M4 7.5 12 3l8 4.5v9L12 21l-8-4.5v-9Z" /><path d="m4 7.5 8 4.5 8-4.5M12 12v9m-4-16 8 4.5" /></>,
    orders: <><path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3Z" /><path d="M9 8h6m-6 4h6m-6 4h3" /></>,
    store: <><path d="M3 10 5 3h14l2 7M4 10v11h16V10M9 21v-7h6v7" /><path d="M3 10a3 3 0 0 0 4.5 2 3 3 0 0 0 4.5 0 3 3 0 0 0 4.5 0A3 3 0 0 0 21 10" /></>,
    sofa: <><path d="M5 12V7a3 3 0 0 1 3-3h8a3 3 0 0 1 3 3v5M5 16h14M5 20v-2m14 2v-2" /><path d="M5 11H3v7h18v-7h-2v5H5v-5Z" /></>,
    truck: <><path d="M3 5h11v12H3V5Zm11 4h4l3 4v4h-7" /><circle cx="7" cy="18" r="2" /><circle cx="18" cy="18" r="2" /></>,
    tag: <><path d="m3 3 9 1 9 9-8 8-9-9-1-9Z" /><circle cx="8" cy="8" r="1" /></>,
    check: <path d="m5 12 4 4L19 6" />,
    exit: <><path d="M9 4H4v16h5m5-13 5 5-5 5m-6-5h13" /></>,
  }
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>{paths[name]}</svg>
}
