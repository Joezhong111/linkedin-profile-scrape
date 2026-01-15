import React, { useRef } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';

interface Props {
    children: React.ReactNode;
    className?: string;
}

export default function PageTransition({ children, className = '' }: Props) {
    const container = useRef<HTMLDivElement>(null);

    useGSAP(() => {
        // Kill any existing tweens to prevent conflicts
        gsap.killTweensOf(container.current);

        gsap.fromTo(
            container.current,
            { opacity: 0, y: 20, filter: 'blur(4px)' },
            {
                opacity: 1,
                y: 0,
                filter: 'blur(0px)',
                duration: 0.6,
                ease: 'power3.out',
                clearProps: 'filter' // Clear filter after animation for performance
            }
        );
    }, { scope: container, dependencies: [children] }); // Re-run when children change (route change)

    return (
        <div ref={container} className={`w-full ${className}`}>
            {children}
        </div>
    );
}
