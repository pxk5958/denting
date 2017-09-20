# Real-time denting of rigid bodies

# Author
Pratith Kanagaraj (pxk5958@rit.edu)

# Description
Realistic denting effects of rigid bodies in modern day computer games is required for immersive gameplay. For efficiency, we create dent on the mesh of the target rigid body using a displacement map that is computed on-the-fly using a smoothed Z-buffer profile of the projectile rigid body.

# References
1.	S Patkar, M Aanjaneya, A Bartle, M Lee, R Fedkiw: Efficient denting and bending of rigid bodies. Proceedings of the ACM SIGGRAPH/Eurographics Symposium on Computer Animation, 2014.

# Software
three.js framework (WebGL 2.0)

# Timeline
Week 5: Implement Z-buffer algorithm
Week 6, 7: Implement computation of upper envelope of Gaussians
Week 8: Smooth the Z-buffer profile using the upper envelope of Gaussians
Week 9: Implement smoothing the profile using modified heat equation
Week 10: Interpolate denting over time for animation
Week 11, 12: Evaluation with different 3D models
Week 13, 14: Finishing touches and presentation
