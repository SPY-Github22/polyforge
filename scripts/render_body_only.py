import bpy

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath="/home/sudpy/Downloads/female_body_only.glb")

cam_data = bpy.data.cameras.new("Cam")
cam_obj = bpy.data.objects.new("Cam", cam_data)
bpy.context.scene.collection.objects.link(cam_obj)
bpy.context.scene.camera = cam_obj

light_data = bpy.data.lights.new(name="Sun", type='SUN')
light_data.energy = 4.0
light_obj = bpy.data.objects.new(name="Sun", object_data=light_data)
bpy.context.scene.collection.objects.link(light_obj)
light_obj.rotation_euler = (0.7, 0.2, 0.5)

cam_obj.location = (0, -2.4, 0.85)
cam_obj.rotation_euler = (1.57, 0, 0)
bpy.context.scene.render.resolution_x = 800
bpy.context.scene.render.resolution_y = 1000
bpy.context.scene.render.filepath = "/home/sudpy/.gemini/antigravity-cli/brain/8bd8d386-8923-4fdf-beaa-399fc867af7a/female_body_only.png"
bpy.ops.render.render(write_still=True)
print("Rendered body only to female_body_only.png")
