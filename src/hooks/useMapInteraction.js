// src/hooks/useMapInteraction.js
import { useState, useCallback, useEffect } from 'react';

const TILE_SIZE = 32;
const OVERSCROLL_AMOUNT = 0;

export const useMapInteraction = (viewportRef, mapContainerRef, worldState, playerCity) => {
    const [pan, setPan] = useState({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(0.15);
    const [minZoom, setMinZoom] = useState(0.15);
    const [isPanning, setIsPanning] = useState(false);
    const [startPos, setStartPos] = useState({ x: 0, y: 0 });
    const [borderOpacity, setBorderOpacity] = useState({ top: 0, bottom: 0, left: 0, right: 0 });
    const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });

    const clampPan = useCallback((newPan, currentZoom) => {
        if (!viewportRef.current || !worldState?.islands) return newPan;
        const mapWidth = worldState.width * TILE_SIZE;
        const mapHeight = worldState.height * TILE_SIZE;
        const { clientWidth: viewportWidth, clientHeight: viewportHeight } = viewportRef.current;
        const minX = viewportWidth - mapWidth * currentZoom;
        const minY = viewportHeight - mapHeight * currentZoom;

        setBorderOpacity({
            left: Math.max(0, Math.min(1, newPan.x / OVERSCROLL_AMOUNT)),
            right: Math.max(0, Math.min(1, (minX - newPan.x) / OVERSCROLL_AMOUNT)),
            top: Math.max(0, Math.min(1, newPan.y / OVERSCROLL_AMOUNT)),
            bottom: Math.max(0, Math.min(1, (minY - newPan.y) / OVERSCROLL_AMOUNT)),
        });

        return {
            x: Math.min(OVERSCROLL_AMOUNT, Math.max(minX - OVERSCROLL_AMOUNT, newPan.x)),
            y: Math.min(OVERSCROLL_AMOUNT, Math.max(minY - OVERSCROLL_AMOUNT, newPan.y)),
        };
    }, [worldState, viewportRef]);

    const goToCoordinates = useCallback((x, y) => {
        if (!viewportRef.current) return;
        const { clientWidth: viewportWidth, clientHeight: viewportHeight } = viewportRef.current;
        const targetX = -x * TILE_SIZE * zoom + (viewportWidth / 2) - (TILE_SIZE * zoom / 2);
        const targetY = -y * TILE_SIZE * zoom + (viewportHeight / 2) - (TILE_SIZE * zoom / 2);
        const newPan = clampPan({ x: targetX, y: targetY }, zoom);
        setPan(newPan);
    }, [zoom, clampPan, viewportRef]);

    const centerOnCity = useCallback(() => {
        if (playerCity) {
            goToCoordinates(playerCity.x, playerCity.y);
        }
    }, [playerCity, goToCoordinates]);


    useEffect(() => {
        const viewport = viewportRef.current;
        if (!viewport || !worldState?.islands) return;
        const handleResize = () => {
            setViewportSize({ width: viewport.clientWidth, height: viewport.clientHeight });
            const newMinZoom = Math.max(
                viewport.clientWidth / (worldState.width * TILE_SIZE),
                viewport.clientHeight / (worldState.height * TILE_SIZE),
                0.15
            );
            setMinZoom(newMinZoom);
            setZoom(prevZoom => Math.max(newMinZoom, prevZoom));
        };
        handleResize();
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, [worldState, viewportRef]);

    // #comment This effect now only runs when the active city changes, preventing the map from resetting during panning.
    useEffect(() => {
        if (playerCity) {
            centerOnCity();
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [playerCity?.id]);


    useEffect(() => {
        const container = mapContainerRef.current;
        if (container) {
            container.style.transform = `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`;
        }
    }, [pan, zoom, mapContainerRef]);

    const handleWheel = useCallback((e) => {
        if (!viewportRef.current) return;
        e.preventDefault();
        const scaleAmount = -e.deltaY * 0.002;
        const newZoom = Math.max(minZoom, Math.min(3, zoom + scaleAmount));
        const rect = viewportRef.current.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        const pointX = (mouseX - pan.x) / zoom;
        const pointY = (mouseY - pan.y) / zoom;
        const newPan = clampPan({ x: mouseX - pointX * newZoom, y: mouseY - pointY * newZoom }, newZoom);
        setZoom(newZoom);
        setPan(newPan);
    }, [zoom, pan, clampPan, minZoom, viewportRef]);


    useEffect(() => {
        const viewport = viewportRef.current;
        if (viewport) {
            viewport.addEventListener('wheel', handleWheel, { passive: false });
        }
        return () => {
            if (viewport) {
                viewport.removeEventListener('wheel', handleWheel);
            }
        };
    }, [handleWheel, viewportRef]);


    const handleMouseDown = useCallback((e) => {
        if (e.button !== 0) return;
        setStartPos({ x: e.clientX - pan.x, y: e.clientY - pan.y });
        setIsPanning(true);
    }, [pan]);

    useEffect(() => {
        const handleMouseMove = (e) => {
            if (!isPanning) return;
            const newPan = clampPan({ x: e.clientX - startPos.x, y: e.clientY - startPos.y }, zoom);
            setPan(newPan);
        };
        const handleMouseUp = () => setIsPanning(false);

        if (isPanning) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
        }

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isPanning, startPos, zoom, clampPan]);


    return {
        pan,
        zoom,
        viewportSize,
        borderOpacity,
        isPanning,
        handleMouseDown,
        goToCoordinates,
        centerOnCity
    };
};
