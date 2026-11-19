import { useEffect, useState, type FC } from 'react';
import { MillastMark } from '../MillastMark.js';

/**
 * Barra superior minimalista de estudio: únicamente marca Millast.
 * Gana borde inferior de 1 px #d8d8d8 al desplazarse.
 */
export const AuthTopNav: FC = () => {
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = (): void => {
      setIsScrolled(window.scrollY > 4);
    };

    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <header className={'wf-topnav ' + (isScrolled ? 'wf-topnav--scrolled' : '')}>
      <div className="wf-topnav__inner">
        <div className="wf-topnav__brand">
          <MillastMark variant="light" className="wf-topnav__mark" />
          <span className="wf-topnav__wordmark">Millast</span>
        </div>
      </div>
    </header>
  );
};
