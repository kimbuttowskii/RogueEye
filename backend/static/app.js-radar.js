
function updateRadar(networks) {
    const radar = document.querySelector('.radar-circle');
    // Clear existing markers (keep scanner line and others if any - careful not to remove scanner-line)
    // Actually, let's remove everything except .scanner-line
    const markers = radar.querySelectorAll('.dot-marker');
    markers.forEach(m => m.remove());

    networks.forEach(net => {
        // Distance mapping
        // Radar radius is 100px (200px width/height)
        // Let's say max range displayed is 50m.
        // 0m -> center (0px from center?? No, center is user)
        // Actually typically radar shows user at center.

        let dist = net.Distance;
        if (dist <= 0) dist = 50; // Unknown or far
        if (dist > 50) dist = 50; // Cap at 50m for visual

        // Map distance 0-50m to 0-100% radius
        // Close signals (low distance) should be near center.
        // Far signals (high distance) near edge.
        const msgDistance = (dist / 50) * 100; // Percent from center

        // Random angle since we don't have direction
        const angle = Math.random() * 360;

        // Convert Polar to Cartesian for CSS 'top' and 'left' %
        // Center is 50%, 50%
        // x = r * cos(theta)
        // y = r * sin(theta)

        // r is in percent (0 to 50% effectively of the container size, but let's use 0-45% to keep inside border)
        const radiusPercent = (msgDistance / 100) * 45;

        const angleRad = angle * (Math.PI / 180);
        const x = radiusPercent * Math.cos(angleRad);
        const y = radiusPercent * Math.sin(angleRad);

        const top = 50 + x; // x is horizontal, but top/left... 
        // CSS left is x, top is y. 
        // 50% + x%

        const marker = document.createElement('div');
        marker.className = 'dot-marker';
        marker.style.left = `${50 + x}%`;
        marker.style.top = `${50 + y}%`;

        // Color coding
        if (dist < 10) {
            marker.style.backgroundColor = 'var(--accent-red)';
            marker.style.boxShadow = '0 0 8px var(--accent-red)';
            marker.style.zIndex = 10;
        } else if (dist < 25) {
            marker.style.backgroundColor = 'orange';
            marker.style.boxShadow = '0 0 5px orange';
        } else {
            marker.style.backgroundColor = 'var(--accent-cyan)';
            marker.style.boxShadow = '0 0 4px var(--accent-cyan)';
        }


        // Tooltip
        marker.title = `${net.SSID} (${dist}m) - ${net.Vendor}`;

        radar.appendChild(marker);
    });
}
