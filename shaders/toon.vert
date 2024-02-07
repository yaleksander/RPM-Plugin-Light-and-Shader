uniform vec3 lightDir;

varying float intensity;
varying vec2 vUv;

void main()
{
	vUv = uv;
	intensity = dot(lightDir, normal);
	vec4 modelViewPosition = modelViewMatrix * vec4(position, 1.0);
	gl_Position = projectionMatrix * modelViewPosition;
}
