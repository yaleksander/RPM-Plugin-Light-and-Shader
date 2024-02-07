uniform vec3 diffuse;
uniform vec3 emissive;
uniform float opacity;
uniform float alpha_threshold;
uniform vec4 colorD;
uniform bool reverseH;
uniform vec2 offset;
uniform float repeat;
uniform bool enableShadows;
uniform sampler2D map;

varying float intensity;
varying vec2 vUv;

void main()
{
	vec2 pos;
	vec2 coords = vec2(vUv.x + offset.x, vUv.y + offset.y);
	if (reverseH)
		pos = vec2(1.0 - coords.x, coords.y);
	else
		pos = coords;
	pos = vec2(pos.x - floor(pos.x), pos.y - floor(pos.y));
	vec4 sampledDiffuseColor = texture2D(map, vUv);
	if (sampledDiffuseColor.a <= alpha_threshold)
		discard;
	gl_FragColor = sampledDiffuseColor;

	vec3 rgb = vec3(gl_FragColor.x + colorD.x, gl_FragColor.y + colorD.y, gl_FragColor.z + colorD.z);
	const vec3 W = vec3(0.2125, 0.7154, 0.0721);
	vec3 intensity = vec3(dot(rgb, W));
	gl_FragColor = vec4(mix(intensity, rgb, colorD.w), gl_FragColor.a);
/*
	vec4 color;
	if (intensity > 0.95)

		color = vec4(1.0,0.5,0.5,1.0);
	else if (intensity > 0.5)
		color = vec4(0.6,0.3,0.3,1.0);
	else if (intensity > 0.25)
		color = vec4(0.4,0.2,0.2,1.0);
	else
		color = vec4(0.2,0.1,0.1,1.0);
	gl_FragColor = color;
*/
}
