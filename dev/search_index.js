var documenterSearchIndex = {"docs":
[{"location":"#OptimalMappings.jl","page":"OptimalMappings.jl","title":"OptimalMappings.jl","text":"","category":"section"},{"location":"","page":"OptimalMappings.jl","title":"OptimalMappings.jl","text":"This package contains the code used in the numerical examples of arXiv:2304.14884. It relies on Gridap.jl for finite element routines and WassersteinDictionaries.jl for computational optimal transport.","category":"page"},{"location":"#Example-1","page":"OptimalMappings.jl","title":"Example 1","text":"","category":"section"},{"location":"","page":"OptimalMappings.jl","title":"OptimalMappings.jl","text":"The equation to solve reads  Delta u(x mu) = f(x mu)  x in Omega u(x mu) = 0  x in partial Omega","category":"page"},{"location":"","page":"OptimalMappings.jl","title":"OptimalMappings.jl","text":"using OptimalMappings\nusing Printf\nusing LaTeXStrings\nusing Random\nusing WassersteinDictionaries\nusing Gridap, Gridap.FESpaces, Gridap.CellData\nusing Gridap.CellData: get_cell_quadrature, get_node_coordinates\nusing LineSearches\nusing Plots\nusing GaussianProcesses\nusing Statistics","category":"page"},{"location":"#Setup","page":"OptimalMappings.jl","title":"Setup","text":"","category":"section"},{"location":"","page":"OptimalMappings.jl","title":"OptimalMappings.jl","text":"We begin by setting the hyperparameters: the entropic regulaization strength and the eigenvalue energy tolerance being the most important.","category":"page"},{"location":"","page":"OptimalMappings.jl","title":"OptimalMappings.jl","text":"const ε = 1e-2\nconst τ = 1e-4\nconst τ_eim = 0.1τ\nconst δ⁻¹ = 1e9\nconst κ = 1 / sqrt(ε)\nconst debias = true\nnothing # hide","category":"page"},{"location":"","page":"OptimalMappings.jl","title":"OptimalMappings.jl","text":"Then, we define the PPDE problem and set up the needed FE spaces.","category":"page"},{"location":"","page":"OptimalMappings.jl","title":"OptimalMappings.jl","text":"const nₛ = 50\nconst nₜ = 25\nconst μ_min = -0.35\nconst μ_max = 0.35\nconst var = 1e-3\nP = PoissonProblem(var)\nf(x, x0) = exp(-((x[1] - x0[1])^2 + (x[2] - x0[2])^2) / 2 / P.var) / (2π * P.var)\nnothing # hide","category":"page"},{"location":"","page":"OptimalMappings.jl","title":"OptimalMappings.jl","text":"const d = 2\nconst N = 32\nconst highorder = 3\nconst N_fine = highorder * N\nconst ε_fine = 0.1 / N^2\nfe_spaces = initialize_fe_spaces(N, N_fine, d, highorder, P)\ndΩ = fe_spaces.dΩ\nnothing # hide","category":"page"},{"location":"#Training-and-testing-data","page":"OptimalMappings.jl","title":"Training and testing data","text":"","category":"section"},{"location":"","page":"OptimalMappings.jl","title":"OptimalMappings.jl","text":"We compute the training snapshots u(mu_i)  forall i = 1 dots n_s","category":"page"},{"location":"","page":"OptimalMappings.jl","title":"OptimalMappings.jl","text":"Random.seed!(1234) # hide\nμ_train = testparameterset(nₛ, μ_max, μ_min)\nuE_train = [snapshot(f, μ, fe_spaces.V, fe_spaces.U, dΩ, P) for μ in μ_train]\nu_train = [uE[1] for uE in uE_train]\nE_train = [uE[2] for uE in uE_train]\nnothing # hide","category":"page"},{"location":"","page":"OptimalMappings.jl","title":"OptimalMappings.jl","text":"and the test set.","category":"page"},{"location":"","page":"OptimalMappings.jl","title":"OptimalMappings.jl","text":"μ_test = testparameterset(nₜ, μ_max, μ_min)\nuE_test = [snapshot(f, μ, fe_spaces.V, fe_spaces.U, dΩ, P) for μ in μ_test]\nu_test = [uE[1] for uE in uE_test]\nE_test = [uE[2] for uE in uE_test]\nnothing #hide","category":"page"},{"location":"#Reduced-basis","page":"OptimalMappings.jl","title":"Reduced basis","text":"","category":"section"},{"location":"","page":"OptimalMappings.jl","title":"OptimalMappings.jl","text":"The reduced basis without registration zeta_1 dots zeta_n","category":"page"},{"location":"","page":"OptimalMappings.jl","title":"OptimalMappings.jl","text":"ζ, evd_u = pod(u_train, fe_spaces.V, fe_spaces.U, dΩ, τ)\nn = length(ζ)","category":"page"},{"location":"","page":"OptimalMappings.jl","title":"OptimalMappings.jl","text":"is used solve the reduced problem without registration.","category":"page"},{"location":"","page":"OptimalMappings.jl","title":"OptimalMappings.jl","text":"Aᵣ = OptimalMappings.get_A(μ_train[1], ζ, dΩ)\nũE_rb = [snapshot(f, μ, fe_spaces.V, fe_spaces.U, dΩ, ζ, Aᵣ, P) for μ in μ_test]\nũ_rb = [uE[1] for uE in ũE_rb]\nE_rb = [uE[2] for uE in ũE_rb]\nu_rb = [FEFunction(fe_spaces.V, u' * get_free_dof_values.(ζ)) for u in ũ_rb]\nnothing # hide","category":"page"},{"location":"#Optimal-transport-calculations","page":"OptimalMappings.jl","title":"Optimal transport calculations","text":"","category":"section"},{"location":"","page":"OptimalMappings.jl","title":"OptimalMappings.jl","text":"The choice for rho is rho(mu) = tfracu(mu)^2int u(mu)^2. The reference density bar rho is the (unweighted) OT barycenter. ","category":"page"},{"location":"","page":"OptimalMappings.jl","title":"OptimalMappings.jl","text":"c = WassersteinDictionaries.get_cost_matrix_separated(N_fine+1, d, a=[fe_spaces.domain[1] fe_spaces.domain[3]], b=[fe_spaces.domain[2] fe_spaces.domain[4]])\nk = WassersteinDictionaries.get_gibbs_matrix(c, ε)\nMC = MatrixCache(N_fine + 1)\nρ(u) = u ⋅ u\nρ̂_train = [get_ρ̂(u, ρ, fe_spaces.V_fine, N_fine + 1) for u in u_train]\nSP = SinkhornParameters(Int(10 * ceil(1 / ε)), ε, 1e-3, false, debias, true)\nρ̂_ref = sinkhorn_barycenter_sep([1 / nₛ for _ in ρ̂_train], ρ̂_train, k, SP, MC)\nlog_ρ̂_ref = safe_log.(ρ̂_ref)\nρ_ref = interpolate_everywhere(Interpolable(FEFunction(fe_spaces.V_fine, vec(ρ̂_ref))), fe_spaces.Ψ);\nnothing # hide","category":"page"},{"location":"#Transport-modes","page":"OptimalMappings.jl","title":"Transport modes","text":"","category":"section"},{"location":"","page":"OptimalMappings.jl","title":"OptimalMappings.jl","text":"Next, the transport potentials psi^c_i between bar rho and all rho(mu_i) are computed. The boundary projection guarantees that y mapsto y - nabla psi^c_i(y) is orthogonal to the domain boundary.","category":"page"},{"location":"","page":"OptimalMappings.jl","title":"OptimalMappings.jl","text":"ψ̂ᶜ = [get_ψ̂_ψ̂ᶜ(ρ̂, ρ̂_ref, k, SP, MC)[2] for ρ̂ in ρ̂_train];\nψᶜ = [boundary_projection(ψᶜ, δ⁻¹, κ, fe_spaces.Ψ, dΩ, 2 * highorder) for ψᶜ in ψ̂ᶜ]\nnothing # hide","category":"page"},{"location":"","page":"OptimalMappings.jl","title":"OptimalMappings.jl","text":"The transport modes xi^c_j are obtained by performing a proper orthogonal decomposition on the transport maps as elements of the tangent space of mathcal P at bar rho.","category":"page"},{"location":"","page":"OptimalMappings.jl","title":"OptimalMappings.jl","text":"ξᶜ, evd_ψᶜ = pod_monge_embedding(ψᶜ, ρ_ref, fe_spaces.Ψ, fe_spaces.Ψ, dΩ, τ)\nm = length(ξᶜ)","category":"page"},{"location":"","page":"OptimalMappings.jl","title":"OptimalMappings.jl","text":"x_cord = 0:0.025:1\nξᶜs = []\nfor i in 1:minimum((4,m))\n    push!(ξᶜs, \n        surface(x_cord, x_cord, (x, y) -> ξᶜ[i](Point(x, y)) - ξᶜ[i](Point(0.5, 0.5)),\n        cbar=false, xlabel=L\"x\", ylabel=L\"y\", zlabel=L\"\\xi^c_{%$i}\")\n        )\nend","category":"page"},{"location":"","page":"OptimalMappings.jl","title":"OptimalMappings.jl","text":"plot(ξᶜs...)","category":"page"},{"location":"#The-\\mu-\\mapsto-\\Phi{-1}_\\mu-map","page":"OptimalMappings.jl","title":"The mu mapsto Phi^-1_mu map","text":"","category":"section"},{"location":"","page":"OptimalMappings.jl","title":"OptimalMappings.jl","text":"The mapping Phi^-1_mu y mapsto y - sum_j w(mu)_j nabla xi^c_j(y) is determined by the weights w_j(mu), which are the output of a Gaussian process, fitted to the training data.","category":"page"},{"location":"","page":"OptimalMappings.jl","title":"OptimalMappings.jl","text":"w = [[sum(∫(∇(_ψᶜ) ⋅ ∇(_ξᶜ) * ρ_ref)dΩ) for _ξᶜ in ξᶜ] for _ψᶜ in ψᶜ]\nψᶜ_train = [FEFunction(fe_spaces.Ψ, _w' * get_free_dof_values.(ξᶜ)) for _w in w]\nμ_mat = [μ[k] for k in 1:d, μ in μ_train]\ngp = get_gp(μ_mat, w, m);\nnothing # hide","category":"page"},{"location":"","page":"OptimalMappings.jl","title":"OptimalMappings.jl","text":"plt = plot()\nws = []\nfor i in 1:minimum((4,m))\n    _s = surface(gp[i]; legend=false, xlabel=L\"\\mu_1\", ylabel=L\"\\mu_2\", zlabel=L\"w_{%$i}\", xlim=(μ_min, μ_max), ylim=(μ_min, μ_max))\n    scatter!([μ[1] for μ in μ_train], [μ[2] for μ in μ_train], predict_y(gp[i], μ_mat)[1], label=false, color=:white, markersize=2, aspectratio=1)\n    push!(ws, _s)\nend","category":"page"},{"location":"","page":"OptimalMappings.jl","title":"OptimalMappings.jl","text":"plot(ws...)","category":"page"},{"location":"#Reference-reduced-basis","page":"OptimalMappings.jl","title":"Reference reduced basis","text":"","category":"section"},{"location":"","page":"OptimalMappings.jl","title":"OptimalMappings.jl","text":"With the constructed mappings Phi^-1_mu, we map the solutions from the training set and construct a reduced basis.","category":"page"},{"location":"","page":"OptimalMappings.jl","title":"OptimalMappings.jl","text":"T★u_train = [pushfwd(u_train[i], ψᶜ_train[i], fe_spaces.V, dΩ) for i in eachindex(u_train)]\nϕ, evd_T★u = pod(T★u_train, fe_spaces.V, fe_spaces.U, dΩ, τ)\nnₘ = length(ϕ)","category":"page"},{"location":"","page":"OptimalMappings.jl","title":"OptimalMappings.jl","text":"The mapped snapshots are much easier to compress using linear methods as indicated by the decay of the correlation matrix eigenvalues.","category":"page"},{"location":"","page":"OptimalMappings.jl","title":"OptimalMappings.jl","text":"cpal = palette(:thermal, 4);\nevds = plot(abs.(evd_u.values) ./ evd_u.values[1], yaxis=:log, minorgrid=true, xaxis=:log,\n    yticks=10.0 .^ (-16:2:0), xticks=([1, 10, 100], string.([1, 10, 100])),\n    linewidth=2, marker=:circle, xlabel=L\"n\", ylabel=L\"\\lambda_n / \\lambda_1\", ylim=(1e-16, 2), label=L\"u\", color=cpal[1],\n    legendfontsize=12, tickfontsize=8, xguidefontsize=12, yguidefontsize=12, legend=:bottomleft)\nplot!(abs.(evd_T★u.values) ./ evd_T★u.values[1], linewidth=2, marker=:square, markersize=3, label=L\"u \\circ \\Phi^{-1}\", color=cpal[2])\nplot!(abs.(evd_ψᶜ.values) ./ evd_ψᶜ.values[1], linewidth=2, marker=:diamond, label=L\"\\nabla \\psi^c\", color=cpal[3])","category":"page"},{"location":"","page":"OptimalMappings.jl","title":"OptimalMappings.jl","text":"plot(evds)","category":"page"},{"location":"#Empirical-interpolation","page":"OptimalMappings.jl","title":"Empirical interpolation","text":"","category":"section"},{"location":"","page":"OptimalMappings.jl","title":"OptimalMappings.jl","text":"To construct the empirical iterpolation, we collect the parameter-dependent forms from the training set and perform a proper orthogonal decomposition. The interpolation functions and points are then obtained starting from these POD modes. ","category":"page"},{"location":"","page":"OptimalMappings.jl","title":"OptimalMappings.jl","text":"f_nomap = [interpolate_everywhere(x -> f(x, μ .+ 0.5), fe_spaces.W) for μ in μ_train] # hide\nΞ_f, evd_f = pod(f_nomap, fe_spaces.W, fe_spaces.W, dΩ, τ_eim) # hide\nf★J = [get_f★J(f, μ, get_transport_potential(μ, ξᶜ, fe_spaces.Ψ, gp), fe_spaces.W) for μ in μ_train]\nΞ_f★J, evd_f★J = pod(f★J, fe_spaces.W, fe_spaces.W, dΩ, τ_eim)\neim_f★J = EmpiricalInterpolation(Ξ_f★J, (ϕ,X) -> form_f★J(ϕ,X,dΩ), ϕ, fe_spaces.W)\nK = [get_K(get_transport_potential(μ, ξᶜ, fe_spaces.Ψ, gp), fe_spaces.W_matrix) for μ in μ_train];\nΞ_K, evd_K = pod(K, fe_spaces.W_matrix, fe_spaces.W_matrix, dΩ, τ_eim)\neim_K = EmpiricalInterpolation(Ξ_K, (ϕ,X) -> form_K(ϕ,X,dΩ), ϕ, fe_spaces.W_matrix)\nget_Q(eim_K), get_Q(eim_f★J)","category":"page"},{"location":"","page":"OptimalMappings.jl","title":"OptimalMappings.jl","text":"cpal = palette(:thermal, 4);\neim_evds = plot(abs.(evd_f.values) ./ evd_f.values[1], yaxis=:log, minorgrid=true, xaxis=:log,\n    yticks=10.0 .^ (-16:2:0), xticks=([1, 10, 100], string.([1, 10, 100])),\n    linewidth=2, marker=:circle, xlabel=L\"n\", ylabel=L\"\\lambda_n / \\lambda_1\", ylim=(1e-16, 2), label=L\"f\", color=cpal[1],\n    legendfontsize=12, tickfontsize=8, xguidefontsize=12, yguidefontsize=12, legend=:bottomleft)\nplot!(abs.(evd_f★J.values) ./ evd_f★J.values[1], linewidth=2, marker=:square, markersize=3, label=L\"f \\circ \\Phi^{-1} \\det D\\Phi^{-1}\", color=cpal[2])\nplot!(abs.(evd_K.values) ./ evd_K.values[1], linewidth=2, marker=:diamond, label=L\"[D\\Phi^{-1}]^{-1} [D\\Phi^{-1}]^{-T} \\det D\\Phi^{-1}\", color=cpal[3])","category":"page"},{"location":"","page":"OptimalMappings.jl","title":"OptimalMappings.jl","text":"plot(eim_evds)","category":"page"},{"location":"#Online-phase","page":"OptimalMappings.jl","title":"Online phase","text":"","category":"section"},{"location":"","page":"OptimalMappings.jl","title":"OptimalMappings.jl","text":"The online phase consists of evaluating the mu mapsto w(mu)_j maps and solving the mapped problem in the reference reduced basis. Lastly, the solution is mapped back for plotting using the c-transform.","category":"page"},{"location":"","page":"OptimalMappings.jl","title":"OptimalMappings.jl","text":"ψᶜ_test = [get_transport_potential(μ, ξᶜ, fe_spaces.Ψ, gp) for μ in μ_test]\nũE_trb_eim = [snapshot(f, μ_test[i], fe_spaces.V, fe_spaces.U, dΩ, ϕ, ψᶜ_test[i], eim_f★J, eim_K, P) for i in eachindex(μ_test)];\nnothing # hide","category":"page"},{"location":"","page":"OptimalMappings.jl","title":"OptimalMappings.jl","text":"T★u_trb_eim = [FEFunction(fe_spaces.V, uE[1]' * get_free_dof_values.(ϕ)) for uE in ũE_trb_eim]\nE_trb_eim = [uE[2] for uE in ũE_trb_eim]\nψ̂_test = [c_transform(ψᶜ, fe_spaces.V_fine, c, log_ρ̂_ref, MC, ε_fine) for ψᶜ in ψᶜ_test]\nψ_test = [boundary_projection(ψ, δ⁻¹, κ, fe_spaces.Ψ, dΩ, 2 * highorder) for ψ in ψ̂_test]\nu_trb_eim = [pushfwd(T★u_trb_eim[i], ψ_test[i], fe_spaces.V, dΩ) for i in eachindex(μ_test)]\nΔL2_trb_eim = rel_error_vec(u_trb_eim, u_test, L2, dΩ)\n@printf \"registered (n = %.0f, m = %.0f) \\t L2 error avg.: %.2e ± %.2e \\t max.: %.2e \\n\" nₘ m Statistics.mean(ΔL2_trb_eim) Statistics.std(ΔL2_trb_eim) maximum(ΔL2_trb_eim)","category":"page"},{"location":"","page":"OptimalMappings.jl","title":"OptimalMappings.jl","text":"Lastly, we plot some cross-sections of the worst approximation.","category":"page"},{"location":"","page":"OptimalMappings.jl","title":"OptimalMappings.jl","text":"_i = argmax(ΔL2_trb_eim)\nμ = μ_test[_i]\ncpal = palette(:thermal, 5)\ncross_sec_1 = plot(0:0.005:1, x -> u_test[_i](Point(x, 0.5 + μ_test[_i][2])), linewidth=2, color=cpal[1], xlabel=L\"x\",\n                label=L\"u\", legendfontsize=12, tickfontsize=8, xguidefontsize=12, yguidefontsize=12, dpi=400)\nplot!(0:0.005:1, x -> u_rb[_i](Point(x, 0.5 + μ_test[_i][2])), linewidth=2, color=cpal[2], label=L\"u_{\\mathrm{rb}}\")\nplot!(0:0.005:1, x -> u_trb_eim[_i](Point(x, 0.5 + μ_test[_i][2])), linewidth=2, color=cpal[4], label=L\"u_{\\mathrm{trb, eim}}\")\ncross_sec_2 = plot(0:0.005:1, x -> u_test[_i](Point(0.5 + μ_test[_i][1], x)), linewidth=2, color=cpal[1], xlabel=L\"y\",\n                label=L\"u\", legendfontsize=12, tickfontsize=8, xguidefontsize=12, yguidefontsize=12, dpi=400)\nplot!(0:0.005:1, x -> u_rb[_i](Point(0.5 + μ_test[_i][1], x)), linewidth=2, color=cpal[2], label=L\"u_{\\mathrm{rb}}\")\nplot!(0:0.005:1, x -> u_trb_eim[_i](Point(0.5 + μ_test[_i][1], x)), linewidth=2, color=cpal[4], label=L\"u_{\\mathrm{trb, eim}}\")","category":"page"},{"location":"","page":"OptimalMappings.jl","title":"OptimalMappings.jl","text":"plot(cross_sec_1, cross_sec_2)","category":"page"}]
}
