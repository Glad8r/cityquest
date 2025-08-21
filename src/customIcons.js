import L from 'leaflet';

export const userIcon = new L.Icon({
  iconUrl: 'https://cdn-icons-png.flaticon.com/512/149/149071.png',
  iconSize: [32, 32],
  iconAnchor: [16, 32],
  popupAnchor: [0, -32],
});

export const checkpointIcon = new L.Icon({
  iconUrl: 'https://cdn-icons-png.flaticon.com/512/684/684908.png',
  iconSize: [32, 32],
  iconAnchor: [16, 32],
  popupAnchor: [0, -32],
});

// Create a compass icon function that can be rotated
export const createCompassIcon = (heading = 0) => {
  return L.divIcon({
    className: 'compass-icon',
    html: `
      <div style="
        width: 32px;
        height: 32px;
        background: #4299e1;
        border: 3px solid #2b6cb0;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        position: relative;
        transform: rotate(${heading}deg);
        box-shadow: 0 2px 4px rgba(0,0,0,0.3);
      ">
        <div style="
          width: 0;
          height: 0;
          border-left: 8px solid transparent;
          border-right: 8px solid transparent;
          border-bottom: 16px solid #ffffff;
          position: absolute;
          top: 2px;
        "></div>
        <div style="
          width: 4px;
          height: 4px;
          background: #2b6cb0;
          border-radius: 50%;
          position: absolute;
        "></div>
      </div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -16],
  });
};
