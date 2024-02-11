#include <common>
#include <bsdfs>
#include <packing>
#include <gradientmap_pars_fragment>
#include <lights_pars_begin>
#include <shadowmap_pars_fragment>
#include <shadowmask_pars_fragment>

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
uniform vec3 specular;
uniform float shininess;

varying vec2 vUV;
varying vec3 vNormal;
varying vec3 fragPos;

#if NUM_DIR_LIGHT_SHADOWS > 0
void getDirShadowMasks(inout float dirShadows[NUM_DIR_LIGHT_SHADOWS])
{
	#if NUM_DIR_LIGHT_SHADOWS > 0
		DirectionalLightShadow directionalLight;
		#pragma unroll_loop_start
		for (int i = 0; i < NUM_DIR_LIGHT_SHADOWS; i++)
		{
			directionalLight = directionalLightShadows[i];
			dirShadows[i] = receiveShadow ? getShadow(
				directionalShadowMap[i],
				directionalLight.shadowMapSize,
				directionalLight.shadowBias,
				directionalLight.shadowRadius,
				vDirectionalShadowCoord[i]
			) : 1.0;
		}
		#pragma unroll_loop_end
	#endif
}
#endif

#if NUM_SPOT_LIGHT_SHADOWS > 0
void getSpotShadowMasks(inout float spotShadows[NUM_SPOT_LIGHT_SHADOWS])
{
	#if NUM_SPOT_LIGHT_SHADOWS > 0
		SpotLightShadow spotLight;
		#pragma unroll_loop_start
		for (int i = 0; i < NUM_SPOT_LIGHT_SHADOWS; i++)
		{
			spotLight = spotLightShadows[i];
			spotShadows[i] = receiveShadow ? getShadow(
				spotShadowMap[i],
				spotLight.shadowMapSize,
				spotLight.shadowBias,
				spotLight.shadowRadius,
				vSpotLightCoord[i]
			) : 1.0;
		}
		#pragma unroll_loop_end
	#endif
}
#endif

#if NUM_POINT_LIGHT_SHADOWS > 0
void getPointShadowMasks(inout float pointShadows[NUM_POINT_LIGHT_SHADOWS])
{
	#if NUM_POINT_LIGHT_SHADOWS > 0
		PointLightShadow pointLight;
		#pragma unroll_loop_start
		for (int i = 0; i < NUM_POINT_LIGHT_SHADOWS; i++)
		{
			pointLight = pointLightShadows[i];
			pointShadows[i] = receiveShadow ? getPointShadow(
				pointShadowMap[i],
				pointLight.shadowMapSize,
				pointLight.shadowBias,
				pointLight.shadowRadius,
				vPointShadowCoord[i],
				pointLight.shadowCameraNear,
				pointLight.shadowCameraFar
			) : 1.0;
		}
		#pragma unroll_loop_end
	#endif
}
#endif

float flatten(in float value, in int layers)
{
	float threshold = 1.0 / float(layers);
	float result = 1.0;
	for (int i = 1; i < layers; i++)
	{
		if (value < float(i) * threshold)
		{
			result = float(i - 1) / float(layers - 1);
			break;
		}
	}
	return result;
}

#if NUM_POINT_LIGHTS > 0
vec4 getPointLight(const in int i, out ReflectedLight reflectedLight, in float shadow)
{
	vec3 lightToFrag = pointLights[i].position - fragPos;
	float dist = length(lightToFrag);
	vec3 dir = normalize(lightToFrag);
	float att = getDistanceAttenuation(dist, pointLights[i].distance, pointLights[i].decay);
	vec3 color = pointLights[i].color * flatten(att, 5) * shadow;

	vec3 irradiance = getGradientIrradiance(normalize(vNormal), dir) * color;
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert(diffuse);
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert(diffuse);

//	float shadow = getShadowMask();

	vec3 viewDir = normalize(cameraPosition - fragPos);
	vec3 halfwayDir = normalize(dir + viewDir);
	vec3 diff = max(dot(viewDir, vNormal), 0.0) * color;
	vec3 spec = pow(max(dot(vNormal, halfwayDir), 0.0), shininess) * color;
	return vec4(0.0);
	return vec4(diff + spec, 0.0);
}
#endif

void main()
{
	vec4 ambient = vec4(ambientLightColor.rgb / PI, 1.0); // maybe "/ PI" will have to be removed on more recent three.js revisions
	vec2 coords = vec2(vUV.x + offset.x, vUV.y + offset.y);
	vec2 pos = reverseH ? vec2(1.0 - coords.x, coords.y) : coords;
	pos = vec2(pos.x - floor(pos.x), pos.y - floor(pos.y));
	vec4 tex = texture2D(map, pos * repeat);
	if (tex.a <= alpha_threshold)
		discard;

	#if NUM_DIR_LIGHT_SHADOWS > 0
		float dirShadows[NUM_DIR_LIGHT_SHADOWS];
		getDirShadowMasks(dirShadows);
	#endif
	#if NUM_SPOT_LIGHT_SHADOWS > 0
		float spotShadows[NUM_SPOT_LIGHT_SHADOWS];
		getSpotShadowMasks(spotShadows);
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
		float pointShadows[NUM_POINT_LIGHT_SHADOWS];
		getPointShadowMasks(pointShadows);
	#endif

	gl_FragColor = ambient + vec4(emissive, 0.0);
	vec3 rgb = vec3(gl_FragColor.x + colorD.x, gl_FragColor.y + colorD.y, gl_FragColor.z + colorD.z);
	vec3 intensity = vec3(dot(rgb, vec3(0.2125, 0.7154, 0.0721)));
	gl_FragColor = vec4(mix(intensity, rgb, colorD.w), gl_FragColor.a);
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	#if NUM_POINT_LIGHTS > 0
		#pragma unroll_loop_start
		for (int i = 0; i < NUM_POINT_LIGHTS; i++)
			gl_FragColor += getPointLight(i, reflectedLight, pointShadows[i]);
		#pragma unroll_loop_end
		gl_FragColor += vec4(reflectedLight.directDiffuse + reflectedLight.indirectDiffuse, 0.0);
	#endif
/*
	#ifdef DECODE_VIDEO_TEXTURE
		// inline sRGB decode (TODO: Remove this code when https://crbug.com/1256340 is solved)
		tex = vec4(mix(pow(tex.rgb * 0.9478672986 + vec3(0.0521327014), vec3(2.4)), tex.rgb * 0.0773993808, vec3(lessThanEqual(tex.rgb, vec3(0.04045)))), tex.w);
	#endif
*/
	gl_FragColor *= tex;
}
